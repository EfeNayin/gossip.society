import { API_URL } from '@/config';
import { sessionManager } from '@/session';
import { createDiscoverApi } from './discover-api';
import { createDiscoverService } from './discover-query';

export const discoverService = createDiscoverService({
  manager: sessionManager,
  api: createDiscoverApi(API_URL),
});
