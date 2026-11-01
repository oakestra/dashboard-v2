import { isApiError } from '@oakestra/api';

// One implementation for the shell and addons, which get it from the SDK.
export { describeError } from '@oakestra/api';

/**
 * True for errors the auth layer already dealt with: a 401 that survived the refresh-and-retry
 * means the session ended and the user is on their way to the login page.
 */
export function isSessionError(error: unknown): boolean {
  return isApiError(error) && error.status === 401;
}
