import { Controller, Get, UnauthorizedException } from '@nestjs/common';
import type { MyVenuesResponse, SafeUser } from '@gossip/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { VenuesService } from './venues.service.js';

@Controller('venues')
export class VenuesController {
  constructor(private readonly venues: VenuesService) {}

  // Role policy: VENUE_OWNER only, for now. ADMIN manages venues through
  // /admin/venues, and INFLUENCER / VENUE_STAFF have no use for this yet.
  // The role check says "this user is a venue owner"; WHICH venues come back
  // is decided here by the owner id of the authenticated session.
  @Get('mine')
  @Roles('VENUE_OWNER')
  mine(@CurrentUser() user: SafeUser | undefined): Promise<MyVenuesResponse> {
    // AuthGuard always sets the user on non-public routes.
    if (!user) throw new UnauthorizedException();
    return this.venues.listOwnedBy(user.id);
  }
}
