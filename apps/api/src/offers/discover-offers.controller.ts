import { Controller, Get, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import {
  discoverQuerySchema,
  type DiscoverOffer,
  type DiscoverOfferList,
  type DiscoverQuery,
} from '@gossip/shared';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { OffersService } from './offers.service.js';

// INFLUENCER only (the global guards also require an ACTIVE account). There is
// no guest discovery: without a token the global guard answers 401. The path is
// not under /offers so it can never meet /offers/mine.
@Controller('discover/offers')
@Roles('INFLUENCER')
export class DiscoverOffersController {
  constructor(private readonly offers: OffersService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(discoverQuerySchema)) query: DiscoverQuery,
  ): Promise<DiscoverOfferList> {
    return this.offers.listDiscoverable(query);
  }

  @Get(':id')
  get(
    @Param('id', new ZodValidationPipe(z.guid())) id: string,
  ): Promise<DiscoverOffer> {
    return this.offers.getDiscoverable(id);
  }
}
