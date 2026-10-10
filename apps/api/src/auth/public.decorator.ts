import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Opts a route out of the global AuthGuard. Everything else requires a token. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
