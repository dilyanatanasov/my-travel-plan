import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';

/**
 * Rejects guest sessions. Runs after the global JwtAuthGuard has populated
 * `req.user`, so a guest — an anonymous row with no credentials, hence
 * `email === null` — is turned away with 403 while a registered user passes.
 *
 * Used to keep expensive, abusable endpoints (the paid-upstream flight search)
 * off the guest path, where `/auth/guest` hands anyone a session for free.
 */
@Injectable()
export class NonGuestGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user || user.email == null) {
      throw new ForbiddenException(
        'This feature requires a full account. Please sign up to continue.',
      );
    }
    return true;
  }
}
