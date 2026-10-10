-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "operation" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "offerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

-- CreateIndex
CREATE INDEX "IdempotencyKey_offerId_idx" ON "IdempotencyKey"("offerId");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_userId_operation_key_key" ON "IdempotencyKey"("userId", "operation", "key");

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written (Prisma can't express CHECK constraints). The API validates the
-- same rules; these keep the table sane if something else writes to it.
ALTER TABLE "IdempotencyKey"
  ADD CONSTRAINT "IdempotencyKey_key_length_check"
    CHECK (char_length("key") BETWEEN 16 AND 128),
  ADD CONSTRAINT "IdempotencyKey_requestHash_length_check"
    CHECK (char_length("requestHash") = 64),
  ADD CONSTRAINT "IdempotencyKey_operation_check"
    CHECK (char_length("operation") BETWEEN 1 AND 64),
  ADD CONSTRAINT "IdempotencyKey_expiresAt_check"
    CHECK ("expiresAt" > "createdAt");
