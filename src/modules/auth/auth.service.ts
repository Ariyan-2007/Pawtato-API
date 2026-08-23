import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
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
import { generateToken, hashToken } from './utils/token.util';
import { describeUserAgent } from './utils/user-agent.util';
import { formatDhakaDateTime } from './utils/date.util';
import { extractEmailAddress } from '../../mail/mail-address.util';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const EMAIL_VERIFICATION_TTL_LABEL = '24 hours';
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const PASSWORD_RESET_TTL_LABEL = '1 hour';

const GENERIC_RESET_MESSAGE =
  'If that email is registered, a password reset link has been sent.';
const GENERIC_RESEND_MESSAGE =
  'If that account exists and is unverified, a new verification link has been sent.';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    // Deliberate exception to the Phase 4 "no direct NotificationsService
    // calls" convention: these are security-sensitive, single-purpose
    // transactional emails that must never be persisted as a general in-app
    // Notification (unlike the domain-event-driven business notifications),
    // so they're sent directly rather than routed through the event bus.
    private readonly notificationsService: NotificationsService,
  ) {}

  async register(registerDto: RegisterDto) {
    const user = await this.usersService.createUser(registerDto);

    await this.issueEmailVerificationToken(
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
    const tokenHash = hashToken(dto.token);
    const user = await this.usersService.findByVerificationTokenHash(tokenHash);

    if (
      !user ||
      !user.emailVerificationExpiresAt ||
      user.emailVerificationExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Invalid or expired verification link');
    }

    await this.usersService.markEmailVerified(user._id.toString());

    return { message: 'Email verified successfully.' };
  }

  async resendVerification(dto: ResendVerificationDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (user && !user.isEmailVerified) {
      await this.issueEmailVerificationToken(
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

  async forgotPassword(dto: ForgotPasswordDto, userAgent?: string) {
    const user = await this.usersService.findByEmail(dto.email);

    if (user) {
      const token = generateToken();
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

      await this.usersService.setPasswordResetToken(
        user._id.toString(),
        tokenHash,
        expiresAt,
      );

      const resetUrl = this.buildFrontendUrl('/reset', { token });

      await this.sendTemplateEmail(
        user.email,
        'Reset your Pawtato password',
        'forgot-password',
        {
          name: user.fullName,
          resetUrl,
          expiresIn: PASSWORD_RESET_TTL_LABEL,
          requestContext: describeUserAgent(userAgent),
          supportEmail: this.supportEmail,
        },
      );
    }

    // Same reasoning as resendVerification: never reveal whether the email
    // is registered.
    return { message: GENERIC_RESET_MESSAGE };
  }

  async resetPassword(dto: ResetPasswordDto, userAgent?: string) {
    const tokenHash = hashToken(dto.token);
    const user = await this.usersService.findByResetTokenHash(tokenHash);

    if (
      !user ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Invalid or expired reset link');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    const changedAt = await this.usersService.resetPassword(
      user._id.toString(),
      hashedPassword,
    );

    await this.sendTemplateEmail(
      user.email,
      'Your Pawtato password was changed',
      'password-reset',
      {
        name: user.fullName,
        changedAt: formatDhakaDateTime(changedAt),
        requestContext: describeUserAgent(userAgent),
        loginUrl: this.buildFrontendUrl('/login'),
        supportEmail: this.supportEmail,
      },
    );

    return { message: 'Password reset successfully. You can now log in.' };
  }

  private async issueEmailVerificationToken(
    userId: string,
    email: string,
    fullName: string,
  ) {
    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

    await this.usersService.setEmailVerificationToken(
      userId,
      tokenHash,
      expiresAt,
    );

    const verifyUrl = this.buildFrontendUrl('/verify', { token });

    await this.sendTemplateEmail(
      email,
      'Verify your email to activate your Pawtato tags',
      'verify-email',
      {
        name: fullName,
        verifyUrl,
        expiresIn: EMAIL_VERIFICATION_TTL_LABEL,
        supportEmail: this.supportEmail,
      },
    );
  }

  // A failed email send must never fail the request that already succeeded
  // (registration, forgot-password, reset-password) — best-effort, logged
  // on failure.
  private async sendTemplateEmail(
    to: string,
    subject: string,
    template: string,
    context: Record<string, unknown>,
  ) {
    try {
      await this.notificationsService.sendTemplateEmail(
        to,
        subject,
        template,
        context,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send "${template}" email to ${to}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private buildFrontendUrl(
    pathname: string,
    query?: Record<string, string>,
  ): string {
    const base = this.configService
      .get<string>('app.frontendUrl', 'http://localhost:3000')
      .replace(/\/$/, '');

    const search = query ? `?${new URLSearchParams(query).toString()}` : '';

    return `${base}${pathname}${search}`;
  }

  private get supportEmail(): string {
    return extractEmailAddress(
      this.configService.get<string>('mail.from', 'hello@pawtato.app'),
    );
  }
}
