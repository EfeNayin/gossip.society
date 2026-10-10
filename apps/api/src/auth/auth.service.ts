import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import {
  loginResponseSchema,
  type LoginRequest,
  type LoginResponse,
  type RefreshRequest,
  type RefreshResponse,
} from '@gossip/shared';
import { env } from '../env.js';
import type { Prisma, User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertAccountActive } from './account-status.js';
import { generateRefreshToken, hashRefreshToken } from './refresh-token.js';

type Tx = Prisma.TransactionClient;

// Rotation is decided inside a transaction, but the 401/403 is thrown only
// after it commits: throwing inside would roll back the session revocation.
type RotationOutcome =
  | { kind: 'ok'; response: RefreshResponse }
  | { kind: 'invalid' }
  | { kind: 'reuse'; sessionId: string }
  | { kind: 'blocked'; user: User };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // Verified against when the user or hash is missing, so unknown emails cost
  // the same time as wrong passwords and can't be told apart by timing.
  private dummyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login({ email, password }: LoginRequest): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const storedHash = user?.passwordHash ?? (await this.getDummyHash());

    let passwordMatches = false;
    try {
      passwordMatches = await verify(storedHash, password);
    } catch {
      // A malformed stored hash is treated like a wrong password.
    }

    // Same 401 for unknown email, wrong password and null passwordHash.
    if (!user || !user.passwordHash || !passwordMatches) {
      throw new UnauthorizedException('E-posta veya parola hatalı.');
    }

    // Only reached with a correct password, so it doesn't reveal account state
    // to someone who doesn't know the password.
    assertAccountActive(user);

    // Session, first refresh token and access token are created in one
    // transaction: if signing fails nothing is left behind.
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.authSession.create({
        data: {
          userId: user.id,
          expiresAt: new Date(now.getTime() + env.SESSION_TTL_SECONDS * 1000),
        },
      });
      const response = await this.issueTokens(tx, user, session, now);
      if (!response) throw new Error('A new session has no time left.');
      return response;
    });
  }

  async refresh({ refreshToken }: RefreshRequest): Promise<RefreshResponse> {
    const outcome = await this.prisma.$transaction((tx) =>
      this.rotate(tx, refreshToken, new Date()),
    );

    switch (outcome.kind) {
      case 'ok':
        return outcome.response;
      case 'reuse':
        // Log the session id only, never the token.
        this.logger.warn(
          `Refresh token reuse detected; session ${outcome.sessionId} revoked.`,
        );
        throw invalidSession();
      case 'blocked':
        assertAccountActive(outcome.user);
        throw invalidSession();
      case 'invalid':
        throw invalidSession();
    }
  }

  /** Revokes one session. Other sessions of the same user are not affected. */
  async logout(sessionId: string): Promise<void> {
    await this.revokeSession(this.prisma, sessionId, new Date());
  }

  private async rotate(
    tx: Tx,
    rawToken: string,
    now: Date,
  ): Promise<RotationOutcome> {
    const token = await tx.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(rawToken) },
    });
    // An unknown token touches nothing, so it can't revoke anyone's session.
    if (!token) return { kind: 'invalid' };

    // Conditional UPDATE = validity check + row lock in one statement. A
    // concurrent refresh or logout on this session waits here, then re-checks
    // the condition against the committed result, so a revoked session can
    // never be brought back.
    const lock = await tx.authSession.updateMany({
      where: {
        id: token.sessionId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { lastRefreshedAt: now },
    });
    if (lock.count === 0) return { kind: 'invalid' };

    // Atomic consume: of two requests presenting the same token, only one
    // changes a row. The other is treated as reuse.
    const consumed = await tx.refreshToken.updateMany({
      where: { id: token.id, usedAt: null },
      data: { usedAt: now },
    });
    if (consumed.count === 0) {
      await this.revokeSession(tx, token.sessionId, now);
      return { kind: 'reuse', sessionId: token.sessionId };
    }

    const session = await tx.authSession.findUniqueOrThrow({
      where: { id: token.sessionId },
      include: { user: true },
    });
    if (session.user.status !== 'ACTIVE') {
      await this.revokeSession(tx, session.id, now);
      return { kind: 'blocked', user: session.user };
    }

    const response = await this.issueTokens(tx, session.user, session, now);
    return response ? { kind: 'ok', response } : { kind: 'invalid' };
  }

  // Creates the next refresh token and a matching access token. The access
  // token never outlives the session's absolute expiry.
  private async issueTokens(
    tx: Tx,
    user: User,
    session: { id: string; expiresAt: Date },
    now: Date,
  ): Promise<LoginResponse | undefined> {
    const nowSeconds = Math.floor(now.getTime() / 1000);
    const exp = Math.min(
      nowSeconds + env.JWT_ACCESS_TTL_SECONDS,
      Math.floor(session.expiresAt.getTime() / 1000),
    );
    if (exp <= nowSeconds) return undefined;

    const refresh = generateRefreshToken();
    await tx.refreshToken.create({
      data: { sessionId: session.id, tokenHash: refresh.hash },
    });
    const accessToken = await this.jwt.signAsync(
      { sid: session.id, exp },
      { subject: user.id },
    );

    return loginResponseSchema.parse({
      accessToken,
      accessTokenExpiresAt: new Date(exp * 1000).toISOString(),
      refreshToken: refresh.token,
      refreshTokenExpiresAt: session.expiresAt.toISOString(),
      user,
    });
  }

  private async revokeSession(
    db: Pick<Tx, 'authSession'>,
    sessionId: string,
    now: Date,
  ) {
    await db.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= hash('dummy-password-for-timing-equalisation');
    return this.dummyHash;
  }
}

function invalidSession() {
  return new UnauthorizedException('Oturum geçersiz veya süresi dolmuş.');
}
