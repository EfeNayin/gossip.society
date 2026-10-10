import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  loginRequestSchema,
  safeUserSchema,
  type LoginRequest,
  type LoginResponse,
  type SafeUser,
} from '@gossip/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AuthService } from './auth.service.js';
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

  @Get('me')
  me(@CurrentUser() user: SafeUser | undefined): SafeUser {
    // AuthGuard always sets the user on non-public routes; parsing again keeps
    // the response restricted to the safe fields.
    return safeUserSchema.parse(user);
  }
}
