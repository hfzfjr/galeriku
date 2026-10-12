import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type {
  AcceptedResponse,
  ForgotPasswordRequest,
  GoogleErrorCode,
  LoginRequest,
  MeResponse,
  RegisterRequest,
  RegisterResponse,
  ResendCodeRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
} from '@galeriku/contracts';
import { GOOGLE_ERROR_CODES } from '@galeriku/contracts';
import {
  forgotPasswordRequestSchema,
  loginRequestSchema,
  registerRequestSchema,
  resendCodeRequestSchema,
  resetPasswordRequestSchema,
  verifyEmailRequestSchema,
} from '@galeriku/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { CurrentUser, type SessionUser } from './guards/auth.guard';
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
import { ApiError } from '../common/errors/api-error';
import { getClientIp, getUserAgent } from '../common/utils/client-ip';
import {
  GoogleAuthError,
  GOOGLE_OAUTH_COOKIE,
  GOOGLE_OAUTH_COOKIE_MAX_AGE_SEC,
  GOOGLE_OAUTH_COOKIE_PATH,
  GoogleService,
  isValidState,
  parseOauthCookie,
} from './services/google.service';
import { EmailRateLimitGuard } from '../common/rate-limit/email-rate-limit.guard';
import { Public } from '../common/decorators/public.decorator';
import { RateLimit } from '../common/rate-limit/rate-limit.decorator';
import { RateLimitEmail } from '../common/rate-limit/rate-limit-email.decorator';
import { RateLimitGuard } from '../common/rate-limit/rate-limit.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly google: GoogleService,
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

  private redirectLoginError(
    reply: FastifyReply,
    code: GoogleErrorCode,
  ): void {
    // Fastify v5: redirect(url, code). Kode diisi eksplisit karena status
    // mentah bisa sudah 200 saat redirect dipanggil.
    reply.redirect(
      `${this.config.frontendOrigin}/login?error=${encodeURIComponent(code)}`,
      302,
    );
  }

  // US-11: mulai login Google. Tanpa kredensial (non-produksi): galat JSON
  // jelas, bagian lain tetap jalan. Rate limit menjawab redirect
  // ?error=rate_limited (halaman penuh, bukan JSON).
  @Public()
  @Get('google')
  googleStart(
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ): void {
    if (!this.google.isConfigured()) {
      throw new ApiError(
        503,
        'GOOGLE_UNCONFIGURED',
        'Login Google belum dikonfigurasi.',
      );
    }
    try {
      this.google.checkRateLimit(getClientIp(req));
    } catch (error) {
      if (error instanceof GoogleAuthError) {
        this.redirectLoginError(reply, error.code);
        return;
      }
      throw error;
    }
    const { redirectUrl, state, verifier } = this.google.startLogin();
    reply.setCookie(GOOGLE_OAUTH_COOKIE, `${state}.${verifier}`, {
      path: GOOGLE_OAUTH_COOKIE_PATH,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: GOOGLE_OAUTH_COOKIE_MAX_AGE_SEC,
      secure: this.config.isProduction,
    });
    reply.redirect(redirectUrl, 302);
  }

  // US-11: callback Google. Semua kegagalan -> redirect 302 ke
  // /login?error=<kode>; sukses -> cookie sesi SAMA seperti login manual
  // lalu redirect ke /app.
  @Public()
  @Get('google/callback')
  async googleCallback(
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
    @Query('code') code: unknown,
    @Query('state') state: unknown,
    @Query('error') providerError: unknown,
  ): Promise<void> {
    try {
      this.google.checkRateLimit(getClientIp(req));
      if (typeof providerError === 'string' && providerError.length > 0) {
        throw new GoogleAuthError(
          providerError === 'access_denied'
            ? GOOGLE_ERROR_CODES.google_cancelled
            : GOOGLE_ERROR_CODES.google_failed,
        );
      }
      const saved = parseOauthCookie(req.cookies?.[GOOGLE_OAUTH_COOKIE]);
      // Cookie sekali pakai: selalu dihapus.
      reply.clearCookie(GOOGLE_OAUTH_COOKIE, {
        path: GOOGLE_OAUTH_COOKIE_PATH,
      });
      if (
        !saved ||
        !isValidState(state, saved.state) ||
        typeof code !== 'string' ||
        code.length === 0
      ) {
        throw new GoogleAuthError(GOOGLE_ERROR_CODES.google_failed);
      }
      const profile = await this.google.fetchProfile(code, saved.verifier);
      const { token } = await this.auth.googleLogin(
        profile,
        getClientIp(req),
        getUserAgent(req),
      );
      this.setSessionCookie(reply, token);
      reply.redirect(`${this.config.frontendOrigin}/app`, 302);
    } catch (error) {
      if (error instanceof GoogleAuthError) {
        this.redirectLoginError(reply, error.code);
        return;
      }
      // Tak terduga: jangan bocorkan apa pun, samakan dengan gagal.
      this.logger.warn('Callback Google gagal tak terduga.');
      this.redirectLoginError(reply, GOOGLE_ERROR_CODES.google_failed);
    }
  }
}
