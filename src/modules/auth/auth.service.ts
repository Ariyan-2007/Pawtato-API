import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';

import * as bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { generateOtp } from './utils/otp.util';

const EMAIL_VERIFICATION_TTL_MS = 10 * 60 * 1000; // 10 minutes
const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000; // 15 minutes
const OTP_HASH_ROUNDS = 10;

const GENERIC_RESET_MESSAGE =
  'If that email is registered, a password reset code has been sent.';
const GENERIC_RESEND_MESSAGE =
  'If that account exists and is unverified, a new verification code has been sent.';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    // Deliberate exception to the Phase 4 "no direct NotificationsService
    // calls" convention: OTP emails are security-sensitive, single-purpose,
    // and must never be persisted as a general in-app Notification (unlike
    // the domain-event-driven business notifications), so they're sent
    // directly rather than routed through the event bus.
    private readonly notificationsService: NotificationsService,
  ) {}

  async register(registerDto: RegisterDto) {
    const user = await this.usersService.createUser(registerDto);

    await this.issueEmailVerificationCode(
      user.id.toString(),
      user.email,
      user.fullName,
    );

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user,
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
    };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.usersService.findByEmailWithVerificationCode(
      dto.email,
    );

    if (!user) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    if (user.isEmailVerified) {
      return { message: 'Email already verified.' };
    }

    if (
      !user.emailVerificationCodeHash ||
      !user.emailVerificationExpiresAt ||
      user.emailVerificationExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    const isCodeValid = await bcrypt.compare(
      dto.code,
      user.emailVerificationCodeHash,
    );

    if (!isCodeValid) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    await this.usersService.markEmailVerified(user._id.toString());

    return { message: 'Email verified successfully.' };
  }

  async resendVerification(dto: ResendVerificationDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (user && !user.isEmailVerified) {
      await this.issueEmailVerificationCode(
        user._id.toString(),
        user.email,
        user.fullName,
      );
    }

    // Always return the same message whether or not the account exists (or
    // is already verified) so this endpoint can't be used to enumerate
    // registered emails.
    return { message: GENERIC_RESEND_MESSAGE };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (user) {
      const code = generateOtp();
      const codeHash = await bcrypt.hash(code, OTP_HASH_ROUNDS);
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

      await this.usersService.setPasswordResetCode(
        user._id.toString(),
        codeHash,
        expiresAt,
      );

      await this.sendOtpEmail(
        user.email,
        user.fullName,
        'Reset your Pawtato password',
        code,
        'password reset',
        15,
      );
    }

    // Same reasoning as resendVerification: never reveal whether the email
    // is registered.
    return { message: GENERIC_RESET_MESSAGE };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.usersService.findByEmailWithResetCode(dto.email);

    if (
      !user ||
      !user.passwordResetCodeHash ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Invalid or expired reset code');
    }

    const isCodeValid = await bcrypt.compare(
      dto.code,
      user.passwordResetCodeHash,
    );

    if (!isCodeValid) {
      throw new BadRequestException('Invalid or expired reset code');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.usersService.resetPassword(user._id.toString(), hashedPassword);

    return { message: 'Password reset successfully. You can now log in.' };
  }

  private async issueEmailVerificationCode(
    userId: string,
    email: string,
    fullName: string,
  ) {
    const code = generateOtp();
    const codeHash = await bcrypt.hash(code, OTP_HASH_ROUNDS);
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

    await this.usersService.setEmailVerificationCode(
      userId,
      codeHash,
      expiresAt,
    );

    await this.sendOtpEmail(
      email,
      fullName,
      'Verify your Pawtato email',
      code,
      'email verification',
      10,
    );
  }

  // A failed email send must never fail the request that already succeeded
  // (registration, forgot-password) — best-effort, logged on failure.
  private async sendOtpEmail(
    to: string,
    fullName: string,
    subject: string,
    code: string,
    purpose: string,
    ttlMinutes: number,
  ) {
    try {
      await this.notificationsService.sendEmail(
        to,
        subject,
        `Hi ${fullName}, your Pawtato ${purpose} code is: <strong style="font-size: 20px; letter-spacing: 4px;">${code}</strong>. ` +
          `This code expires in ${ttlMinutes} minutes. If you didn't request this, you can safely ignore this email.`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send ${purpose} email to ${to}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
