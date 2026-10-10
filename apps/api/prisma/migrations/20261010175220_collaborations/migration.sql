-- CreateEnum
CREATE TYPE "CollaborationStatus" AS ENUM ('APPLIED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Collaboration" (
    "id" UUID NOT NULL,
    "offerId" UUID NOT NULL,
    "influencerId" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "status" "CollaborationStatus" NOT NULL DEFAULT 'APPLIED',
    "appliedAt" TIMESTAMP(3) NOT NULL,
    "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "termsSnapshot" JSONB NOT NULL,
    "decidedAt" TIMESTAMP(3),
    "decidedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collaboration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollaborationEvent" (
    "id" UUID NOT NULL,
    "collaborationId" UUID NOT NULL,
    "fromStatus" "CollaborationStatus",
    "toStatus" "CollaborationStatus" NOT NULL,
    "actorId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollaborationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Collaboration_venueId_approvedAt_idx" ON "Collaboration"("venueId", "approvedAt");

-- CreateIndex
CREATE INDEX "Collaboration_venueId_appliedAt_idx" ON "Collaboration"("venueId", "appliedAt");

-- CreateIndex
CREATE INDEX "Collaboration_offerId_status_idx" ON "Collaboration"("offerId", "status");

-- CreateIndex
CREATE INDEX "Collaboration_influencerId_appliedAt_idx" ON "Collaboration"("influencerId", "appliedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Collaboration_offerId_influencerId_key" ON "Collaboration"("offerId", "influencerId");

-- CreateIndex
CREATE INDEX "CollaborationEvent_collaborationId_createdAt_idx" ON "CollaborationEvent"("collaborationId", "createdAt");

-- AddForeignKey
ALTER TABLE "Collaboration" ADD CONSTRAINT "Collaboration_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collaboration" ADD CONSTRAINT "Collaboration_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collaboration" ADD CONSTRAINT "Collaboration_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collaboration" ADD CONSTRAINT "Collaboration_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborationEvent" ADD CONSTRAINT "CollaborationEvent_collaborationId_fkey" FOREIGN KEY ("collaborationId") REFERENCES "Collaboration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborationEvent" ADD CONSTRAINT "CollaborationEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written (Prisma can't express CHECK constraints). The service enforces
-- the same rules; these keep the tables sane whatever writes to them.

-- A row's fields agree with its status. APPROVED rows keep approvedAt for good
-- (the permanent basis of the monthly quota); a later task that adds
-- cancellation will relax this check by migration, not by clearing approvedAt.
ALTER TABLE "Collaboration"
  ADD CONSTRAINT "Collaboration_status_fields_check" CHECK (
    ("status" = 'APPLIED'
       AND "decidedAt" IS NULL AND "decidedById" IS NULL AND "approvedAt" IS NULL)
    OR ("status" = 'APPROVED'
       AND "decidedAt" IS NOT NULL AND "decidedById" IS NOT NULL AND "approvedAt" IS NOT NULL)
    OR ("status" = 'REJECTED'
       AND "decidedAt" IS NOT NULL AND "decidedById" IS NOT NULL AND "approvedAt" IS NULL)
  ),
  ADD CONSTRAINT "Collaboration_decidedAt_check"
    CHECK ("decidedAt" IS NULL OR "decidedAt" >= "appliedAt"),
  ADD CONSTRAINT "Collaboration_termsSnapshot_check"
    CHECK (jsonb_typeof("termsSnapshot") = 'object');

-- The only transitions this task implements: creation (no previous status) as
-- APPLIED, and APPLIED -> APPROVED | REJECTED.
-- (IS NOT NULL is explicit: a CHECK also passes when its condition is NULL, and
-- "fromStatus" = 'APPLIED' is NULL for a creation entry.)
ALTER TABLE "CollaborationEvent"
  ADD CONSTRAINT "CollaborationEvent_transition_check" CHECK (
    ("fromStatus" IS NULL AND "toStatus" = 'APPLIED')
    OR ("fromStatus" IS NOT NULL AND "fromStatus" = 'APPLIED'
        AND "toStatus" IN ('APPROVED', 'REJECTED'))
  );
