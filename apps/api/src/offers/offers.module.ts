import { Module } from '@nestjs/common';
import { AdminOffersController } from './admin-offers.controller.js';
import { DiscoverOffersController } from './discover-offers.controller.js';
import { OffersService } from './offers.service.js';
import { OwnerOffersController } from './owner-offers.controller.js';

@Module({
  controllers: [
    OwnerOffersController,
    AdminOffersController,
    DiscoverOffersController,
  ],
  providers: [OffersService],
})
export class OffersModule {}
