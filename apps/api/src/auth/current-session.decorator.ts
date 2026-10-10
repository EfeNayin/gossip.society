import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from './auth.types.js';

/** Id of the session the current access token belongs to. */
export const CurrentSessionId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().sessionId,
);
