import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { Auth } from '../services/auth';

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/** Reads a cookie set by the Laravel server (cookies are shared between localhost ports). */
function readCookie(name: string): string | null {
  for (const cookie of document.cookie.split(';')) {
    const [key, ...rest] = cookie.trim().split('=');
    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

/**
 * Cookie-based Sanctum authentication for requests to the Laravel API:
 *  - sends the session cookie cross-origin (withCredentials);
 *  - copies the XSRF-TOKEN cookie into the X-XSRF-TOKEN header on write requests
 *    (Angular's built-in XSRF support ignores absolute URLs, so it is done here);
 *  - when the server says the session is gone (401), logs the user out locally
 *    and sends them to the login page;
 *  - recovers from 419 (CSRF token mismatch) on write requests, see below.
 *
 * Why 419 needs special handling: Laravel checks the CSRF token BEFORE it checks the
 * login. Once the server session has expired, every write (POST/PUT/PATCH/DELETE) is
 * answered with 419 instead of 401, and the 419 response does not refresh the
 * XSRF-TOKEN cookie, so retrying the same request fails forever. A 419 therefore means
 * "stale token OR expired session" and is resolved here instead of guessed:
 *   1. GET /sanctum/csrf-cookie  -> a fresh XSRF-TOKEN cookie;
 *   2. GET /api/me               -> the authoritative answer (reads are not CSRF-checked);
 *        401 -> the session really ended: log out, go to the login page;
 *        200 -> only the token was stale: retry the request ONCE with the new token.
 * If the retry is still rejected the mismatch is genuine: the user stays logged in and
 * the page shows the server's message. Nothing here bypasses CSRF validation.
 */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const baseUrl = inject(API_BASE_URL);

  if (!req.url.startsWith(baseUrl)) {
    return next(req);
  }

  const auth = inject(Auth);
  const router = inject(Router);
  const http = inject(HttpClient);

  const isWrite = !SAFE_METHODS.includes(req.method.toUpperCase());
  const isAuthRequest = /\/api\/(login|register|me)$/.test(req.url);

  // Built again for a retry, so it picks up an XSRF-TOKEN cookie that was just refreshed.
  const prepare = () => {
    let headers = req.headers.set('Accept', 'application/json');

    if (isWrite) {
      const token = readCookie('XSRF-TOKEN');

      if (token) {
        headers = headers.set('X-XSRF-TOKEN', token);
      }
    }

    return req.clone({ withCredentials: true, headers });
  };

  const endSession = () => {
    auth.setCurrentUser(null);
    router.navigate(['/login']);
  };

  // 401 on a protected request: the server session is gone.
  const fail = (error: HttpErrorResponse) => {
    if (error.status === 401 && !isAuthRequest && auth.isLoggedIn()) {
      endSession();
    }

    return throwError(() => error);
  };

  const recoverFromCsrfMismatch = (original: HttpErrorResponse) =>
    http.get(`${baseUrl}/sanctum/csrf-cookie`).pipe(
      switchMap(() => http.get(`${baseUrl}/api/me`)),
      catchError((check: HttpErrorResponse) => {
        // Only a 401 from /api/me proves the session ended. Any other failure of the
        // check (server error, offline) proves nothing: keep the user logged in.
        if (check.status === 401 && auth.isLoggedIn()) {
          endSession();
        }

        return throwError(() => original);
      }),
      // Session still valid: only the token was stale. Retry exactly once.
      switchMap(() => next(prepare()).pipe(catchError(fail))),
    );

  return next(prepare()).pipe(
    catchError((error: HttpErrorResponse) =>
      error.status === 419 && isWrite && !isAuthRequest
        ? recoverFromCsrfMismatch(error)
        : fail(error),
    ),
  );
};
