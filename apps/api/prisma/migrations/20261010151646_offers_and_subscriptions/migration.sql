-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUSPENDED');

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "activeOfferQuota" INTEGER NOT NULL,
    "monthlyMatchQuota" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "serviceDescription" TEXT NOT NULL,
    "serviceValueKurus" INTEGER NOT NULL,
    "expectedContent" TEXT NOT NULL,
    "minFollowers" INTEGER NOT NULL DEFAULT 0,
    "capacity" INTEGER NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "suspensionReason" TEXT,
    "suspendedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_name_key" ON "SubscriptionPlan"("name");

-- CreateIndex
CREATE INDEX "Subscription_venueId_startsAt_endsAt_idx" ON "Subscription"("venueId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "Subscription_planId_idx" ON "Subscription"("planId");

-- CreateIndex
CREATE INDEX "Offer_branchId_createdAt_idx" ON "Offer"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "Offer_status_validUntil_idx" ON "Offer"("status", "validUntil");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "VenueBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_suspendedById_fkey" FOREIGN KEY ("suspendedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written (Prisma cannot express these).

-- A venue's subscription periods never overlap, so at most one subscription is
-- valid at any moment and the quota to apply is unambiguous. Periods are
-- half-open: one may start exactly when the previous one ends.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_period_check" CHECK ("endsAt" > "startsAt");
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_no_overlap" EXCLUDE USING gist ("venueId" WITH =, tsrange("startsAt", "endsAt") WITH &&);

ALTER TABLE "SubscriptionPlan" ADD CONSTRAINT "SubscriptionPlan_quotas_check" CHECK ("activeOfferQuota" >= 0 AND "monthlyMatchQuota" >= 0);

ALTER TABLE "Offer" ADD CONSTRAINT "Offer_values_check" CHECK ("serviceValueKurus" > 0 AND "capacity" > 0 AND "minFollowers" >= 0);
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_period_check" CHECK ("validUntil" > "validFrom");
-- A published or suspended offer was published; a suspended one says who, when and why.
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_status_fields_check" CHECK (
  ("status" = 'DRAFT' OR "publishedAt" IS NOT NULL)
  AND ("status" <> 'SUSPENDED' OR ("suspendedAt" IS NOT NULL AND "suspensionReason" IS NOT NULL AND "suspendedById" IS NOT NULL))
);
