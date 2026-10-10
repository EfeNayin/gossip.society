import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { HealthResponse } from '@gossip/shared';
import { Public } from '../auth/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        db: 'down',
      } satisfies HealthResponse);
    }
    return { status: 'ok', db: 'up' };
  }
}
