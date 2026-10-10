import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import {
  loginResponseSchema,
  type LoginRequest,
  type LoginResponse,
} from '@gossip/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertAccountActive } from './account-status.js';

@Injectable()
export class AuthService {
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

    const accessToken = await this.jwt.signAsync({}, { subject: user.id });
    return loginResponseSchema.parse({ accessToken, user });
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= hash('dummy-password-for-timing-equalisation');
    return this.dummyHash;
  }
}
