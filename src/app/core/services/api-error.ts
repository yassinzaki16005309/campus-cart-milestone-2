import { HttpErrorResponse } from '@angular/common/http';

/**
 * Turns a failed API call into the message shown in the page's existing
 * error area: the server's own message when there is one (404, 403, 409, 422 ...),
 * a connection message when the server cannot be reached, otherwise the fallback.
 */
export function apiErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'Cannot reach the server. Please check your connection and try again.';
    }

    const message = error.error?.message;

    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
}
