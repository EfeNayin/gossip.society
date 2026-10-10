import { API_URL } from '@/config';
import { sessionManager } from '@/session';
import { createOffersApi } from './offers-api';
import { createOffersService } from './offers-query';

export const offersService = createOffersService({
  manager: sessionManager,
  api: createOffersApi(API_URL),
});
