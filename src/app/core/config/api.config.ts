import { InjectionToken } from '@angular/core';

/**
 * Base URL of the Laravel server (no trailing slash).
 * The REST API lives under `${API_BASE_URL}/api`.
 * Override it in app.config.ts or in a test with { provide: API_BASE_URL, useValue: '...' }.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => 'http://localhost:8000',
});
