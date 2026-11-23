import { HttpErrorResponse, HttpEventType, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { PerformanceMonitor } from './performance-monitor';

/**
 * Metric 2: API response time, as the page experiences it.
 *
 * Registered BEFORE apiInterceptor, so it is the outermost one: the duration includes
 * the 419 recovery (CSRF refresh + retry) when that happens. Only requests to the
 * Laravel API are measured, only when monitoring is enabled, and only URL, method,
 * status and duration are reported (never headers or bodies).
 */
export const performanceInterceptor: HttpInterceptorFn = (req, next) => {
  const monitor = inject(PerformanceMonitor);

  if (!monitor.enabled || !req.url.startsWith(inject(API_BASE_URL))) {
    return next(req);
  }

  const startedAt = monitor.now();

  return next(req).pipe(
    tap({
      next: (event) => {
        if (event.type === HttpEventType.Response) {
          monitor.recordApiCall(req.method, req.url, event.status, monitor.now() - startedAt);
        }
      },
      error: (error: HttpErrorResponse) => {
        monitor.recordApiCall(req.method, req.url, error.status, monitor.now() - startedAt);
      },
    }),
  );
};
