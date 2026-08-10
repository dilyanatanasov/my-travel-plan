import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opt an endpoint out of the globally-registered JwtAuthGuard.
 *
 * The guard is global (deny by default) so that a new endpoint is protected
 * unless someone deliberately opens it. Use this only for auth endpoints and
 * shared reference data (countries, airports) — never for user data.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
