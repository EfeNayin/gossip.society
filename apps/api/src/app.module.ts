import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { CollaborationsModule } from './collaborations/collaborations.module.js';
import { HealthModule } from './health/health.module.js';
import { OffersModule } from './offers/offers.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { VenuesModule } from './venues/venues.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    HealthModule,
    VenuesModule,
    OffersModule,
    CollaborationsModule,
  ],
})
export class AppModule {}
