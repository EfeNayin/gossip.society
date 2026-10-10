import { collaborationStatusSchema } from '@gossip/shared';
import { CollaborationStatus } from '../generated/prisma/enums.js';

describe('Prisma CollaborationStatus matches the shared schema', () => {
  it('has the same statuses', () => {
    expect(Object.values(CollaborationStatus).sort()).toEqual(
      [...collaborationStatusSchema.options].sort(),
    );
  });
});
