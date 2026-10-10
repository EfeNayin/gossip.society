import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  loginRequestSchema,
  refreshRequestSchema,
  safeUserSchema,
  type LoginRequest,
  type LoginResponse,
  type RefreshRequest,
  type RefreshResponse,
  type SafeUser,
} from '@gossip/shared';
import { env } from '../env.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AuthService } from './auth.service.js';
import { CurrentSessionId } from './current-session.decorator.js';
import { CurrentUser } from './current-user.decorator.js';
import { Public } from './public.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(200)
  login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest,
  ): Promise<LoginResponse> {
    return this.auth.login(body);
  }

  // Takes no access token: the refresh token in the body is the credential.
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: env.REFRESH_RATE_LIMIT,
      ttl: env.REFRESH_RATE_WINDOW_SECONDS * 1000,
    },
  })
  @Post('refresh')
  @HttpCode(200)
  refresh(
    @Body(new ZodValidationPipe(refreshRequestSchema)) body: RefreshRequest,
  ): Promise<RefreshResponse> {
    return this.auth.refresh(body);
  }

  // Revokes only the session of the access token used for this request.
  @Post('logout')
  @HttpCode(204)
  async logout(
    @CurrentSessionId() sessionId: string | undefined,
  ): Promise<void> {
    // AuthGuard always sets the session id on non-public routes.
    if (!sessionId) throw new UnauthorizedException();
    await this.auth.logout(sessionId);
  }

  @Get('me')
  me(@CurrentUser() user: SafeUser | undefined): SafeUser {
    // AuthGuard always sets the user on non-public routes; parsing again keeps
    // the response restricted to the safe fields.
    return safeUserSchema.parse(user);
  }
}
