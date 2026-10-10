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
  createCollaborationRequestSchema,
  listMyCollaborationsQuerySchema,
  listReceivedCollaborationsQuerySchema,
  type CreateCollaborationRequest,
  type ListMyCollaborationsQuery,
  type ListReceivedCollaborationsQuery,
  type MyCollaboration,
  type MyCollaborationList,
  type ReceivedCollaboration,
  type ReceivedCollaborationList,
  type SafeUser,
} from '@gossip/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CollaborationService } from './collaboration.service.js';

const idPipe = new ZodValidationPipe(z.guid());

// The caller is always the authenticated user: no body, query or path ever
// names an influencer, an owner, a status or an event.
function caller(user: SafeUser | undefined): string {
  if (!user) throw new UnauthorizedException();
  return user.id;
}

// ACTIVE INFLUENCER only (the global guards also require an ACTIVE account).
@Controller('collaborations/mine')
@Roles('INFLUENCER')
export class MyCollaborationsController {
  constructor(private readonly collaborations: CollaborationService) {}

  @Post()
  @HttpCode(201)
  apply(
    @CurrentUser() user: SafeUser | undefined,
    @Body(new ZodValidationPipe(createCollaborationRequestSchema))
    body: CreateCollaborationRequest,
  ): Promise<MyCollaboration> {
    return this.collaborations.apply(caller(user), body.offerId);
  }

  @Get()
  list(
    @CurrentUser() user: SafeUser | undefined,
    @Query(new ZodValidationPipe(listMyCollaborationsQuerySchema))
    query: ListMyCollaborationsQuery,
  ): Promise<MyCollaborationList> {
    return this.collaborations.listMine(caller(user), query);
  }

  @Get(':id')
  get(
    @CurrentUser() user: SafeUser | undefined,
    @Param('id', idPipe) id: string,
  ): Promise<MyCollaboration> {
    return this.collaborations.getMine(caller(user), id);
  }
}

// ACTIVE VENUE_OWNER only, and only applications to offers of their own venues
// (someone else's looks like one that doesn't exist: 404).
@Controller('collaborations/received')
@Roles('VENUE_OWNER')
export class ReceivedCollaborationsController {
  constructor(private readonly collaborations: CollaborationService) {}

  @Get()
  list(
    @CurrentUser() user: SafeUser | undefined,
    @Query(new ZodValidationPipe(listReceivedCollaborationsQuerySchema))
    query: ListReceivedCollaborationsQuery,
  ): Promise<ReceivedCollaborationList> {
    return this.collaborations.listReceived(caller(user), query);
  }

  @Get(':id')
  get(
    @CurrentUser() user: SafeUser | undefined,
    @Param('id', idPipe) id: string,
  ): Promise<ReceivedCollaboration> {
    return this.collaborations.getReceived(caller(user), id);
  }

  // Approving and rejecting are separate operations with no body: the decision
  // is the path, the decider is the session.
  @Post(':id/approve')
  @HttpCode(200)
  approve(
    @CurrentUser() user: SafeUser | undefined,
    @Param('id', idPipe) id: string,
  ): Promise<ReceivedCollaboration> {
    return this.collaborations.approve(caller(user), id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  reject(
    @CurrentUser() user: SafeUser | undefined,
    @Param('id', idPipe) id: string,
  ): Promise<ReceivedCollaboration> {
    return this.collaborations.reject(caller(user), id);
  }
}
