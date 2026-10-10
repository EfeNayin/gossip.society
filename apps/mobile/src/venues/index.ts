import { API_URL } from '@/config';
import { sessionManager } from '@/session';
import { createVenuesApi } from './venues-api';
import { createMyVenuesFetcher } from './venues-query';

export const fetchMyVenues = createMyVenuesFetcher({
  manager: sessionManager,
  api: createVenuesApi(API_URL),
});
