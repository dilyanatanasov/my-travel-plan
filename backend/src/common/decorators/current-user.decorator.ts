import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  id: number;
  /** Null for guest sessions, which have no credentials. */
  email: string | null;
}

/**
 * Injects the authenticated user attached by JwtStrategy.validate().
 *
 * `@CurrentUser('id')` returns just the id, which is what most controllers want.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;
    return data ? user?.[data] : user;
  },
);
