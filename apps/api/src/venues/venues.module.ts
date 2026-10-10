import { Module } from '@nestjs/common';
import { AdminVenuesController } from './admin-venues.controller.js';
import { VenuesController } from './venues.controller.js';
import { VenuesService } from './venues.service.js';

@Module({
  controllers: [AdminVenuesController, VenuesController],
  providers: [VenuesService],
})
export class VenuesModule {}
