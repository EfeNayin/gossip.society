import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { safeUserSchema } from '@gossip/shared';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertAccountActive } from './account-status.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

const tokenPayloadSchema = z.object({ sub: z.guid() });

/**
 * Global guard: every route needs a valid Bearer access token unless it is
 * marked @Public(). The user and role are reloaded from the database on every
 * request, so suspensions and role changes apply immediately.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) throw invalidSession();

    let userId: string;
    try {
      const payload: unknown = await this.jwt.verifyAsync(token, {
        algorithms: ['HS256'],
      });
      userId = tokenPayloadSchema.parse(payload).sub;
    } catch {
      throw invalidSession();
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw invalidSession();
    assertAccountActive(user);

    request.user = safeUserSchema.parse(user);
    return true;
  }
}

function extractBearerToken(
  header: string | string[] | undefined,
): string | undefined {
  if (typeof header !== 'string') return undefined;
  const [scheme, token, ...rest] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0) {
    return undefined;
  }
  return token;
}

function invalidSession() {
  return new UnauthorizedException('Oturum geçersiz veya süresi dolmuş.');
}
