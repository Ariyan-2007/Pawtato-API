import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { JwtPayload } from './interfaces/jwt-payload.interface';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'Register a new Pawtato account',
    description:
      'Creates the account and emails a verification link (valid 24 hours). ' +
      'The returned access token is usable immediately regardless of verification status.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Account created, access token issued, verification email sent.',
  })
  @ApiResponse({ status: 400, description: 'Validation failed.' })
  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiResponse({
    status: 200,
    description: 'Login successful, access token issued.',
  })
  @ApiResponse({ status: 401, description: 'Invalid email or password.' })
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @ApiOperation({ summary: 'Get the currently authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'The decoded JWT payload for the caller.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return user;
  }

  @ApiOperation({
    summary: 'Verify an email address using the token from the verify link',
    description:
      'Called by the frontend page at FRONTEND_URL/verify?token=... with the token from the query string.',
  })
  @ApiResponse({ status: 200, description: 'Email verified successfully.' })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired verification link.',
  })
  @HttpCode(HttpStatus.OK)
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @ApiOperation({ summary: 'Resend the email verification link' })
  @ApiResponse({
    status: 200,
    description:
      'Generic confirmation message (does not reveal whether the email is registered).',
  })
  @Throttle({ write: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('resend-verification')
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  @ApiOperation({ summary: 'Request a password reset link by email' })
  @ApiResponse({
    status: 200,
    description:
      'Generic confirmation message (does not reveal whether the email is registered).',
  })
  @Throttle({ write: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.forgotPassword(dto, userAgent);
  }

  @ApiOperation({
    summary:
      'Reset a password using the token from the reset link sent by forgot-password',
    description:
      'Called by the frontend page at FRONTEND_URL/reset?token=... with the token from the query string. ' +
      'On success, every existing session (JWT issued before this change) is invalidated and a receipt email is sent.',
  })
  @ApiResponse({ status: 200, description: 'Password reset successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset link.' })
  @Throttle({ write: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  resetPassword(
    @Body() dto: ResetPasswordDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.resetPassword(dto, userAgent);
  }
}
