import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { env } from '../env.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { RolesGuard } from './roles.guard.js';

@Module({
  imports: [
    JwtModule.register({
      secret: env.JWT_SECRET,
      signOptions: {
        algorithm: 'HS256',
        expiresIn: env.JWT_ACCESS_TTL_SECONDS,
      },
    }),
    // Not a global guard: only routes that add ThrottlerGuard are limited.
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: env.LOGIN_RATE_WINDOW_SECONDS * 1000,
          limit: env.LOGIN_RATE_LIMIT,
        },
      ],
      errorMessage:
        'Çok fazla deneme yaptınız. Lütfen biraz sonra tekrar deneyin.',
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    // Global guards run in this order: authenticate first, then check roles.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
