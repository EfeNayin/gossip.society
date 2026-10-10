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

// jsonwebtoken only checks `exp` when it is present, so require it here: a
// token that never expires must not be accepted. The library still enforces
// the expiry itself. Tokens without `sid` (issued before sessions existed) fail
// this schema and need a new login.
const tokenPayloadSchema = z.object({
  sub: z.guid(),
  sid: z.guid(),
  exp: z.number().int().positive(),
});

/**
 * Global guard: every route needs a valid Bearer access token unless it is
 * marked @Public(). The session and the user (status, role) are reloaded from
 * the database on every request, so logout, suspensions and role changes apply
 * immediately. Refresh tokens are opaque strings, not JWTs, so they fail the
 * signature check here.
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

    let claims: z.infer<typeof tokenPayloadSchema>;
    try {
      const payload: unknown = await this.jwt.verifyAsync(token, {
        algorithms: ['HS256'],
      });
      claims = tokenPayloadSchema.parse(payload);
    } catch {
      throw invalidSession();
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: claims.sid },
      include: { user: true },
    });
    if (
      !session ||
      session.userId !== claims.sub ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw invalidSession();
    }
    assertAccountActive(session.user);

    request.user = safeUserSchema.parse(session.user);
    request.sessionId = session.id;
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
