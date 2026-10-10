import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { SafeUser } from '@gossip/shared';
import type { AuthenticatedRequest } from './auth.types.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SafeUser | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
