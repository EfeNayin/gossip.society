import { offerStatusSchema } from '@gossip/shared';
import { OfferStatus } from '../generated/prisma/enums.js';

describe('Prisma OfferStatus matches the shared schema', () => {
  it('has the same statuses', () => {
    expect(Object.values(OfferStatus).sort()).toEqual(
      [...offerStatusSchema.options].sort(),
    );
  });
});
