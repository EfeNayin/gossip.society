import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { healthResponseSchema } from '@gossip/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  const queryRaw = vi.fn();
  let controller: HealthController;

  beforeEach(async () => {
    queryRaw.mockReset();
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: { $queryRaw: queryRaw } }],
    }).compile();
    controller = moduleRef.get(HealthController);
  });

  it('reports ok when the database answers', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await controller.check();

    expect(healthResponseSchema.parse(result)).toEqual({ status: 'ok', db: 'up' });
  });

  it('throws 503 when the database is unreachable', async () => {
    queryRaw.mockRejectedValue(new Error('connection refused'));

    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
