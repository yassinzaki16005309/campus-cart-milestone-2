import { InjectionToken } from '@angular/core';

/**
 * LogRocket App ID, in the form "<organisation-slug>/<app-slug>"
 * (LogRocket dashboard -> Settings -> "Set up LogRocket" -> the text inside LogRocket.init('...')).
 *
 * It is NOT a secret: LogRocket App IDs are public and ship inside every browser bundle.
 *
 * Leave it EMPTY to keep performance monitoring completely switched off:
 * the LogRocket SDK is then not even downloaded, and local development and
 * the automated tests send nothing anywhere.
 */
export const LOGROCKET_APP_ID = 'ckkcbx/campus-cart';

/** Injectable so a test (or another build) can supply its own App ID. */
export const LOGROCKET_APP_ID_TOKEN = new InjectionToken<string>('LOGROCKET_APP_ID', {
  providedIn: 'root',
  factory: () => LOGROCKET_APP_ID,
});
