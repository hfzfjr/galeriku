import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type {
  AcceptedResponse,
  ForgotPasswordRequest,
  LoginRequest,
  MeResponse,
  RegisterRequest,
  RegisterResponse,
  ResendCodeRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
} from '@galeriku/contracts';
import {
  forgotPasswordRequestSchema,
  loginRequestSchema,
  registerRequestSchema,
  resendCodeRequestSchema,
  resetPasswordRequestSchema,
  verifyEmailRequestSchema,
} from '@galeriku/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { APP_CONFIG, type AppConfig } from '../app-config';
import { CurrentUser, type SessionUser } from './auth.guard';
import {
  FORGOT_EMAIL_LIMIT,
  FORGOT_IP_LIMIT,
  LOGIN_EMAIL_LIMIT,
  LOGIN_IP_LIMIT,
  REGISTER_IP_LIMIT,
  RESET_EMAIL_LIMIT,
  RESET_IP_LIMIT,
  RESEND_EMAIL_LIMIT,
  RESEND_IP_LIMIT,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
  VERIFY_EMAIL_LIMIT,
  VERIFY_IP_LIMIT,
} from './auth.constants';
import { AuthService, toMeResponse } from './auth.service';
import { getClientIp, getUserAgent } from './client-ip';
import { EmailRateLimitGuard } from './email-rate-limit.guard';
import { Public } from './public.decorator';
import { RateLimit } from './rate-limit.decorator';
import { RateLimitEmail } from './rate-limit-email.decorator';
import { RateLimitGuard } from './rate-limit.guard';
import { ZodValidationPipe } from './zod-validation.pipe';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private setSessionCookie(reply: FastifyReply, token: string): void {
    reply.setCookie(SESSION_COOKIE, token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE_SEC,
      // Host-only: tanpa atribut Domain. Secure hanya di produksi
      // (dev lokal jalan di http://localhost).
      secure: this.config.isProduction,
    });
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ ...REGISTER_IP_LIMIT, keyPrefix: 'register:ip' })
  @Post('register')
  @HttpCode(201)
  async register(
    @Body(new ZodValidationPipe(registerRequestSchema))
    body: RegisterRequest,
    @Req() req: FastifyRequest,
  ): Promise<RegisterResponse> {
    return this.auth.register(body, getClientIp(req));
  }

  @Public()
  @UseGuards(RateLimitGuard, EmailRateLimitGuard)
  @RateLimit({ ...LOGIN_IP_LIMIT, keyPrefix: 'login:ip' })
  @RateLimitEmail({ ...LOGIN_EMAIL_LIMIT, keyPrefix: 'login:email' })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<MeResponse> {
    const { me, token } = await this.auth.login(
      body,
      getClientIp(req),
      getUserAgent(req),
    );
    this.setSessionCookie(reply, token);
    return me;
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const token = req.cookies?.[SESSION_COOKIE];
    await this.auth.logout(
      typeof token === 'string' ? token : undefined,
    );
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  @Get('me')
  async me(@CurrentUser() user: SessionUser): Promise<MeResponse> {
    return toMeResponse(user);
  }

  @Public()
  @UseGuards(RateLimitGuard, EmailRateLimitGuard)
  @RateLimit({ ...VERIFY_IP_LIMIT, keyPrefix: 'verify:ip' })
  @RateLimitEmail({ ...VERIFY_EMAIL_LIMIT, keyPrefix: 'verify:email' })
  @Post('verify-email')
  @HttpCode(200)
  async verifyEmail(
    @Body(new ZodValidationPipe(verifyEmailRequestSchema))
    body: VerifyEmailRequest,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<MeResponse> {
    const { me, token } = await this.auth.verifyEmail(
      body,
      getClientIp(req),
      getUserAgent(req),
    );
    this.setSessionCookie(reply, token);
    return me;
  }

  @Public()
  @UseGuards(RateLimitGuard, EmailRateLimitGuard)
  @RateLimit({ ...RESEND_IP_LIMIT, keyPrefix: 'resend:ip' })
  @RateLimitEmail({ ...RESEND_EMAIL_LIMIT, keyPrefix: 'resend:email' })
  @Post('resend-code')
  @HttpCode(202)
  async resendCode(
    @Body(new ZodValidationPipe(resendCodeRequestSchema))
    body: ResendCodeRequest,
  ): Promise<AcceptedResponse> {
    return this.auth.resendCode(body);
  }

  @Public()
  @UseGuards(RateLimitGuard, EmailRateLimitGuard)
  @RateLimit({ ...FORGOT_IP_LIMIT, keyPrefix: 'forgot:ip' })
  @RateLimitEmail({ ...FORGOT_EMAIL_LIMIT, keyPrefix: 'forgot:email' })
  @Post('forgot-password')
  @HttpCode(202)
  async forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordRequestSchema))
    body: ForgotPasswordRequest,
    @Req() req: FastifyRequest,
  ): Promise<AcceptedResponse> {
    return this.auth.forgotPassword(body, getClientIp(req));
  }

  @Public()
  @UseGuards(RateLimitGuard, EmailRateLimitGuard)
  @RateLimit({ ...RESET_IP_LIMIT, keyPrefix: 'reset:ip' })
  @RateLimitEmail({ ...RESET_EMAIL_LIMIT, keyPrefix: 'reset:email' })
  @Post('reset-password')
  @HttpCode(204)
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordRequestSchema))
    body: ResetPasswordRequest,
  ): Promise<void> {
    await this.auth.resetPassword(body);
  }
}
