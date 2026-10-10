import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import {
  createVenueRequestSchema,
  listVenuesQuerySchema,
  type AdminVenue,
  type AdminVenueList,
  type CreateVenueRequest,
  type ListVenuesQuery,
} from '@gossip/shared';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { VenuesService } from './venues.service.js';

// ADMIN only (checked by the global AuthGuard and RolesGuard, against the
// current role in the database). Request bodies are never logged.
@Controller('admin/venues')
@Roles('ADMIN')
export class AdminVenuesController {
  constructor(private readonly venues: VenuesService) {}

  @Post()
  @HttpCode(201)
  create(
    @Body(new ZodValidationPipe(createVenueRequestSchema))
    body: CreateVenueRequest,
  ): Promise<AdminVenue> {
    return this.venues.create(body);
  }

  @Get()
  list(
    @Query(new ZodValidationPipe(listVenuesQuerySchema)) query: ListVenuesQuery,
  ): Promise<AdminVenueList> {
    return this.venues.list(query);
  }
}
