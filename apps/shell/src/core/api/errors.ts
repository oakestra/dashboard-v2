import { isApiError } from '@oakestra/api';

/** A sentence for a toast or an inline error, whatever was thrown. */
export function describeError(error: unknown): string {
  if (isApiError(error)) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong.';
}

/**
 * True for errors the auth layer already dealt with: a 401 that survived the refresh-and-retry
 * means the session ended and the user is on their way to the login page.
 */
export function isSessionError(error: unknown): boolean {
  return isApiError(error) && error.status === 401;
}
