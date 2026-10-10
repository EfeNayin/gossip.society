import { ConflictException, Injectable } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import {
  adminVenueListSchema,
  adminVenueSchema,
  myVenuesResponseSchema,
  type AdminVenue,
  type AdminVenueList,
  type CreateVenueRequest,
  type EmailConflictError,
  type ListVenuesQuery,
  type MyVenuesResponse,
} from '@gossip/shared';
import { PrismaService } from '../prisma/prisma.service.js';

// Only these owner columns are ever read for responses: the password hash is
// never selected, and the response schemas would drop it anyway.
const ownerSelect = {
  id: true,
  name: true,
  email: true,
  status: true,
} as const;
const branchesInclude = {
  orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
};

function emailTaken() {
  return new ConflictException({
    statusCode: 409,
    code: 'EMAIL_ALREADY_EXISTS',
    message: 'Bu e-posta adresiyle kayıtlı bir hesap zaten var.',
  } satisfies EmailConflictError);
}

// Creating the owner, venue and branch touches one unique column (the
// e-mail), so any unique violation in that transaction means the e-mail was
// taken, including by a request that raced this one.
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  );
}

@Injectable()
export class VenuesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a VENUE_OWNER account (ACTIVE), its venue and the first branch in
   * one transaction. An existing account is never touched: a taken e-mail is a
   * 409. The role and status are fixed here, never read from the request.
   */
  async create({
    owner,
    venue,
    branch,
  }: CreateVenueRequest): Promise<AdminVenue> {
    // A cheap early answer. The unique constraint below stays the real guard
    // (two requests can pass this check at the same moment).
    const existing = await this.prisma.user.findUnique({
      where: { email: owner.email },
      select: { id: true },
    });
    if (existing) throw emailTaken();

    // The password only ever exists as this hash; it is computed before the
    // transaction so the database isn't held open while it runs.
    const passwordHash = await hash(owner.password);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: owner.email,
            name: owner.name,
            role: 'VENUE_OWNER',
            status: 'ACTIVE',
            passwordHash,
          },
          select: { id: true },
        });
        return tx.venue.create({
          data: {
            name: venue.name,
            description: venue.description ?? null,
            ownerId: user.id,
            branches: { create: { ...branch } },
          },
          include: {
            owner: { select: ownerSelect },
            branches: branchesInclude,
          },
        });
      });
      return adminVenueSchema.parse(created);
    } catch (error) {
      if (isUniqueViolation(error)) throw emailTaken();
      throw error;
    }
  }

  async list({ page, pageSize }: ListVenuesQuery): Promise<AdminVenueList> {
    const [rows, total] = await Promise.all([
      this.prisma.venue.findMany({
        // Newest first; the id breaks ties so pages never shuffle or repeat.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { owner: { select: ownerSelect }, branches: branchesInclude },
      }),
      this.prisma.venue.count(),
    ]);
    return adminVenueListSchema.parse({
      items: rows,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  }

  /** The signed-in owner's own venues. `ownerId` always comes from the session. */
  async listOwnedBy(ownerId: string): Promise<MyVenuesResponse> {
    const rows = await this.prisma.venue.findMany({
      where: { ownerId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: { branches: branchesInclude },
    });
    return myVenuesResponseSchema.parse({ items: rows });
  }
}
