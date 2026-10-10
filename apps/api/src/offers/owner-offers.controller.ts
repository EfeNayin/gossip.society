import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { z } from 'zod';
import {
  createOfferRequestSchema,
  listOffersQuerySchema,
  updateOfferRequestSchema,
  type CreateOfferRequest,
  type ListOffersQuery,
  type OwnerOffer,
  type OwnerOfferList,
  type SafeUser,
  type UpdateOfferRequest,
} from '@gossip/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { OffersService } from './offers.service.js';

const idPipe = new ZodValidationPipe(z.guid());

// VENUE_OWNER only (the global guards also require an ACTIVE account). The
// owner is always the authenticated user; the client never names one. Which
// offers are reachable is decided by the service through branch -> venue ->
// owner, so someone else's offer looks like one that doesn't exist (404).
@Controller('offers/mine')
@Roles('VENUE_OWNER')
export class OwnerOffersController {
  constructor(private readonly offers: OffersService) {}

  private owner(user: SafeUser | undefined): string {
    if (!user) throw new UnauthorizedException();
    return user.id;
  }

  @Post()
  @HttpCode(201)
  create(
    @CurrentUser() user: SafeUser | undefined,
    @Body(new ZodValidationPipe(createOfferRequestSchema))
    body: CreateOfferRequest,
  ): Promise<OwnerOffer> {
    return this.offers.createDraft(this.owner(user), body);
  }

  @Get()
  list(
    @CurrentUser() user: SafeUser | undefined,
    @Query(new ZodValidationPipe(listOffersQuerySchema)) query: ListOffersQuery,
  ): Promise<OwnerOfferList> {
    return this.offers.listMine(this.owner(user), query);
  }

  @Get(':id')
  get(
    @CurrentUser() user: SafeUser | undefined,
    @Param('id', idPipe) id: string,
  ): Promise<OwnerOffer> {
    return this.offers.getMine(this.owner(user), id);
  }

  @Put(':id')
  update(
    @CurrentUser() user: SafeUser | undefined,
    @Param('id', idPipe) id: string,
    @Body(new ZodValidationPipe(updateOfferRequestSchema))
    body: UpdateOfferRequest,
  ): Promise<OwnerOffer> {
    return this.offers.updateDraft(this.owner(user), id, body);
  }

  @Post(':id/publish')
  @HttpCode(200)
  publish(
    @CurrentUser() user: SafeUser | undefined,
    @Param('id', idPipe) id: string,
  ): Promise<OwnerOffer> {
    return this.offers.publish(this.owner(user), id);
  }
}
