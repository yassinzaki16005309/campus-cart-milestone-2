import { Injectable, InjectionToken, effect, inject, untracked } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  NavigationStart,
  Router,
} from '@angular/router';
import type LogRocket from 'logrocket';
import { API_BASE_URL } from '../config/api.config';
import { LOGROCKET_APP_ID_TOKEN } from '../config/logrocket.config';
import { User } from '../models/user.model';
import { Auth } from '../services/auth';

/** The only parts of the LogRocket SDK this app uses. */
export type LogRocketClient = Pick<typeof LogRocket, 'init' | 'track' | 'identify'>;
type LogRocketOptions = NonNullable<Parameters<LogRocketClient['init']>[1]>;

/** Properties allowed on events: plain numbers and labels, never user data. */
type EventProperties = Record<string, string | number | boolean>;

/** Loads the SDK on demand, so nothing is downloaded while monitoring is switched off. */
export const LOGROCKET_CLIENT_LOADER = new InjectionToken<() => Promise<LogRocketClient>>(
  'LOGROCKET_CLIENT_LOADER',
  {
    providedIn: 'root',
    factory: () => async () => (await import('logrocket')).default,
  },
);

/** Monotonic clock in milliseconds (replaceable in tests). */
export const PERFORMANCE_CLOCK = new InjectionToken<() => number>('PERFORMANCE_CLOCK', {
  providedIn: 'root',
  factory: () => () => performance.now(),
});

/**
 * LogRocket accepts at most 2000 event properties per session. API calls are the only
 * high-volume event, so they are capped per page load (5 properties each).
 */
export const MAX_API_EVENTS_PER_PAGE_LOAD = 150;

// ---------------------------------------------------------------------------
// Pure helpers (exported so they can be unit-tested)
// ---------------------------------------------------------------------------

/**
 * Histogram label for a duration. The numeric duration is always sent as well
 * (duration_ms); the bucket only exists so counts can be charted as a distribution.
 */
export function durationBucket(ms: number): string {
  if (ms < 100) return '1) under 100 ms';
  if (ms < 300) return '2) 100-300 ms';
  if (ms < 1000) return '3) 300 ms-1 s';
  if (ms < 3000) return '4) 1-3 s';
  return '5) 3 s or more';
}

/** "/api/invoices/12/pay?x=1" -> "/api/invoices/:id/pay" (no ids, no query string). */
export function normalizeEndpoint(url: string, baseUrl: string): string {
  const path = url.startsWith(baseUrl) ? url.slice(baseUrl.length) : url;
  return path.split(/[?#]/)[0].replace(/\/\d+(?=\/|$)/g, '/:id');
}

/** Page URL without query string or fragment. */
export function sanitizeUrl(url: string): string {
  return url.split(/[?#]/)[0];
}

type Redactable = { headers: Record<string, string | null | undefined>; body?: string };

/**
 * Network records keep only URL, method, status and timing. ALL headers are dropped
 * (Cookie, Set-Cookie, X-XSRF-TOKEN, ...) and ALL bodies are dropped (the login and
 * signup bodies contain passwords and card digits; responses contain personal and
 * financial data). Performance charts need none of it.
 */
export function sanitizeRequest<T extends Redactable>(request: T): T {
  return { ...request, headers: {}, body: undefined };
}

export function sanitizeResponse<T extends Redactable>(response: T): T {
  return { ...response, headers: {}, body: undefined };
}

/** Everything LogRocket is told about what it may record. */
export function buildLogRocketOptions(): LogRocketOptions {
  return {
    release: 'campuscart-milestone-2',
    // Text, inputs and images are masked in session replays (names, emails, card digits).
    dom: { textSanitizer: true, inputSanitizer: true, imageSanitizer: true },
    network: {
      isEnabled: true,
      requestSanitizer: sanitizeRequest,
      responseSanitizer: sanitizeResponse,
    },
    browser: { urlSanitizer: sanitizeUrl },
    console: { isEnabled: false, shouldAggregateConsoleErrors: false },
    shouldCaptureIP: false,
    shouldDetectExceptions: false,
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Sends the three performance metrics to LogRocket as custom events:
 *   1. Route navigation time  - "Route Navigation Started" / "Route Navigation Completed"
 *   2. API response time      - "API Response"
 *   3. Checkout completion    - "Checkout Started" / "Checkout Completed" / "Checkout Failed"
 *
 * Disabled (does nothing, loads nothing) unless a LogRocket App ID is configured.
 * A failure inside monitoring can never break the application.
 */
@Injectable({ providedIn: 'root' })
export class PerformanceMonitor {
  private readonly appId = inject(LOGROCKET_APP_ID_TOKEN).trim();
  private readonly loadClient = inject(LOGROCKET_CLIENT_LOADER);
  private readonly clock = inject(PERFORMANCE_CLOCK);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly router = inject(Router);
  private readonly auth = inject(Auth);

  private client: LogRocketClient | null = null;
  private apiEventCount = 0;
  private pendingNavigation: { id: number; startedAt: number } | null = null;

  readonly enabled = this.appId.length > 0;

  constructor() {
    if (this.enabled) {
      // Tell LogRocket who is logged in: id and role only, never name, email or card.
      effect(() => {
        const user = this.auth.currentUser();
        untracked(() => this.identify(user));
      });
    }
  }

  now(): number {
    return this.clock();
  }

  /** Loads and configures the SDK, then starts route timing. No-op without an App ID. */
  async start(): Promise<void> {
    if (!this.enabled || this.client) {
      return;
    }

    try {
      const client = await this.loadClient();
      client.init(this.appId, buildLogRocketOptions());
      this.client = client;
      this.identify(this.auth.currentUser());
      this.trackRoutes();
    } catch {
      this.client = null; // monitoring is optional: the app keeps working without it
    }
  }

  /** Metric 2: one event per finished API call (including the CSRF/session checks). */
  recordApiCall(method: string, url: string, status: number, durationMs: number): void {
    if (!this.client || this.apiEventCount >= MAX_API_EVENTS_PER_PAGE_LOAD) {
      return;
    }

    this.apiEventCount++;
    const duration = Math.round(durationMs);

    this.track('API Response', {
      endpoint: normalizeEndpoint(url, this.baseUrl),
      method: method.toUpperCase(),
      status,
      duration_ms: duration,
      duration_bucket: durationBucket(duration),
    });
  }

  /** Metric 3: start of a checkout (pair with "Checkout Completed" for the elapsed time). */
  checkoutStarted(paymentOption: string, lineItems: number): void {
    this.track('Checkout Started', { payment_option: paymentOption, line_items: lineItems });
  }

  checkoutCompleted(paymentOption: string, lineItems: number, durationMs: number): void {
    const duration = Math.round(durationMs);

    this.track('Checkout Completed', {
      payment_option: paymentOption,
      line_items: lineItems,
      duration_ms: duration,
      duration_bucket: durationBucket(duration),
    });
  }

  checkoutFailed(
    paymentOption: string,
    lineItems: number,
    durationMs: number,
    status: number,
  ): void {
    const duration = Math.round(durationMs);

    this.track('Checkout Failed', {
      payment_option: paymentOption,
      line_items: lineItems,
      duration_ms: duration,
      duration_bucket: durationBucket(duration),
      status,
    });
  }

  /** Metric 1: time from navigation start to navigation end (includes the lazy-loaded page chunk). */
  private trackRoutes(): void {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.pendingNavigation = { id: event.id, startedAt: this.now() };
        this.track('Route Navigation Started', { route: sanitizeUrl(event.url) || '/' });
      } else if (event instanceof NavigationEnd) {
        if (this.pendingNavigation?.id === event.id) {
          const duration = Math.round(this.now() - this.pendingNavigation.startedAt);
          this.pendingNavigation = null;

          this.track('Route Navigation Completed', {
            route: sanitizeUrl(event.urlAfterRedirects) || '/',
            duration_ms: duration,
            duration_bucket: durationBucket(duration),
          });
        }
      } else if (
        event instanceof NavigationCancel ||
        event instanceof NavigationError ||
        event instanceof NavigationSkipped
      ) {
        // e.g. a guard redirected to /login: the redirect is a new navigation with its own timing
        if (this.pendingNavigation?.id === event.id) {
          this.pendingNavigation = null;
        }
      }
    });
  }

  private identify(user: User | null): void {
    if (!this.client || !user) {
      return;
    }

    try {
      this.client.identify(String(user.id), { role: user.role });
    } catch {
      // ignore: monitoring must never break the app
    }
  }

  private track(name: string, properties: EventProperties): void {
    try {
      this.client?.track(name, properties);
    } catch {
      // ignore: monitoring must never break the app
    }
  }
}
