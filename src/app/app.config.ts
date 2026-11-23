import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { apiInterceptor } from './core/interceptors/api.interceptor';
import { PerformanceMonitor } from './core/monitoring/performance-monitor';
import { performanceInterceptor } from './core/monitoring/performance.interceptor';
import { Auth } from './core/services/auth';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // performanceInterceptor is first = outermost, so API timings include the 419 recovery.
    provideHttpClient(withInterceptors([performanceInterceptor, apiInterceptor])),

    // Restore the server-side login (GET /api/me) before the first render, so the
    // navbar and the route guards already know who the user is after a page reload.
    provideAppInitializer(() => inject(Auth).restoreSession()),

    // LogRocket performance monitoring. Does nothing (and downloads nothing) unless an
    // App ID is set in core/config/logrocket.config.ts.
    provideAppInitializer(() => inject(PerformanceMonitor).start()),
  ],
};
