import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { z } from 'zod';
import {
  listOffersQuerySchema,
  suspendOfferRequestSchema,
  type AdminOffer,
  type AdminOfferList,
  type ListOffersQuery,
  type SafeUser,
  type SuspendOfferRequest,
} from '@gossip/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { OffersService } from './offers.service.js';

const idPipe = new ZodValidationPipe(z.guid());

// ADMIN only. An admin can read every offer and suspend a published one with
// a reason. Reopening, deleting or editing an offer's content is not possible.
@Controller('admin/offers')
@Roles('ADMIN')
export class AdminOffersController {
  constructor(private readonly offers: OffersService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(listOffersQuerySchema)) query: ListOffersQuery,
  ): Promise<AdminOfferList> {
    return this.offers.listAll(query);
  }

  @Get(':id')
  get(@Param('id', idPipe) id: string): Promise<AdminOffer> {
    return this.offers.getAny(id);
  }

  @Post(':id/suspend')
  @HttpCode(200)
  suspend(
    @CurrentUser() admin: SafeUser | undefined,
    @Param('id', idPipe) id: string,
    @Body(new ZodValidationPipe(suspendOfferRequestSchema))
    body: SuspendOfferRequest,
  ): Promise<AdminOffer> {
    if (!admin) throw new UnauthorizedException();
    return this.offers.suspend(admin.id, id, body.reason);
  }
}
