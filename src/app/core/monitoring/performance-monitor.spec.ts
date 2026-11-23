import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import {
  LOGROCKET_CLIENT_LOADER,
  LogRocketClient,
  MAX_API_EVENTS_PER_PAGE_LOAD,
  PERFORMANCE_CLOCK,
  PerformanceMonitor,
  buildLogRocketOptions,
  durationBucket,
  normalizeEndpoint,
  sanitizeRequest,
  sanitizeResponse,
  sanitizeUrl,
} from './performance-monitor';
import { LOGROCKET_APP_ID_TOKEN } from '../config/logrocket.config';
import { Auth } from '../services/auth';

const APP_ID = 'test-org/test-app';
const SERVER = 'http://localhost:8000';

/** A stand-in for the LogRocket SDK: nothing ever leaves the test. */
function fakeClient() {
  return {
    init: jasmine.createSpy('init'),
    track: jasmine.createSpy('track'),
    identify: jasmine.createSpy('identify'),
  };
}

/** A clock that moves forward by `step` ms every time it is read. */
const tickingClock = (step: number) => {
  let now = 0;
  return () => (now += step);
};

function configure(appId: string, client = fakeClient(), clock?: () => number) {
  const loader = jasmine.createSpy('loader').and.resolveTo(client as unknown as LogRocketClient);

  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: '', children: [] },
        { path: 'store', children: [] },
      ]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: LOGROCKET_APP_ID_TOKEN, useValue: appId },
      { provide: LOGROCKET_CLIENT_LOADER, useValue: loader },
      ...(clock ? [{ provide: PERFORMANCE_CLOCK, useValue: clock }] : []),
    ],
  });

  return { client, loader };
}

describe('PerformanceMonitor helpers', () => {
  it('should bucket durations into ordered histogram labels', () => {
    expect(durationBucket(0)).toBe('1) under 100 ms');
    expect(durationBucket(99)).toBe('1) under 100 ms');
    expect(durationBucket(100)).toBe('2) 100-300 ms');
    expect(durationBucket(299)).toBe('2) 100-300 ms');
    expect(durationBucket(300)).toBe('3) 300 ms-1 s');
    expect(durationBucket(999)).toBe('3) 300 ms-1 s');
    expect(durationBucket(1000)).toBe('4) 1-3 s');
    expect(durationBucket(2999)).toBe('4) 1-3 s');
    expect(durationBucket(3000)).toBe('5) 3 s or more');

    const labels = [50, 150, 500, 2000, 9000].map(durationBucket);
    expect([...labels].sort()).toEqual(labels); // charts list groups alphabetically
  });

  it('should turn API URLs into endpoint names without ids or query strings', () => {
    expect(normalizeEndpoint(`${SERVER}/api/invoices/12/pay`, SERVER)).toBe(
      '/api/invoices/:id/pay',
    );
    expect(normalizeEndpoint(`${SERVER}/api/transactions/7`, SERVER)).toBe('/api/transactions/:id');
    expect(normalizeEndpoint(`${SERVER}/api/transactions?department=Bookstore`, SERVER)).toBe(
      '/api/transactions',
    );
    expect(normalizeEndpoint(`${SERVER}/sanctum/csrf-cookie`, SERVER)).toBe('/sanctum/csrf-cookie');
    expect(normalizeEndpoint(`${SERVER}/api/me`, SERVER)).toBe('/api/me');
  });

  it('should strip query strings and fragments from page URLs', () => {
    expect(sanitizeUrl('/store?token=abc#top')).toBe('/store');
    expect(sanitizeUrl('http://localhost:4200/login?x=1')).toBe('http://localhost:4200/login');
  });

  it('should drop every header and body from recorded requests (passwords, cookies, CSRF tokens)', () => {
    const request = {
      reqId: '1',
      url: `${SERVER}/api/login`,
      method: 'POST',
      headers: {
        cookie: 'laravel-session=secret; XSRF-TOKEN=secret',
        'x-xsrf-token': 'secret',
        authorization: 'Bearer secret',
      },
      body: '{"username":"student","password":"Student123","creditCard":"4111111111111111"}',
    };

    const sanitized = sanitizeRequest(request);

    expect(Object.keys(sanitized.headers)).toEqual([]);
    expect(sanitized.body).toBeUndefined();
    expect(JSON.stringify(sanitized)).not.toContain('Student123');
    expect(JSON.stringify(sanitized)).not.toContain('secret');
    // what a duration chart needs is kept
    expect(sanitized.url).toBe(request.url);
    expect(sanitized.method).toBe('POST');
    expect(sanitized.reqId).toBe('1');
  });

  it('should drop every header and body from recorded responses (personal and financial data)', () => {
    const response = {
      reqId: '1',
      url: `${SERVER}/api/me`,
      method: 'GET',
      status: 200,
      headers: { 'set-cookie': 'laravel-session=secret; XSRF-TOKEN=secret' },
      body: '{"data":{"email":"student@campuscart.com","creditCardLast4":"9876"}}',
    };

    const sanitized = sanitizeResponse(response);

    expect(Object.keys(sanitized.headers)).toEqual([]);
    expect(sanitized.body).toBeUndefined();
    expect(JSON.stringify(sanitized)).not.toContain('student@campuscart.com');
    expect(JSON.stringify(sanitized)).not.toContain('9876');
    expect(sanitized.status).toBe(200);
    expect(sanitized.url).toBe(response.url);
  });

  it('should configure LogRocket with every privacy protection switched on', () => {
    const options = buildLogRocketOptions();

    expect(options.dom?.textSanitizer).toBeTrue();
    expect(options.dom?.inputSanitizer).toBeTrue();
    expect(options.dom?.imageSanitizer).toBeTrue();
    expect(options.network?.requestSanitizer).toBe(sanitizeRequest);
    expect(options.network?.responseSanitizer).toBe(sanitizeResponse);
    expect(options.browser?.urlSanitizer?.('/store?a=1')).toBe('/store');
    expect(options.console?.isEnabled).toBeFalse();
    expect(options.shouldCaptureIP).toBeFalse();
    expect(options.shouldDetectExceptions).toBeFalse();
  });
});

describe('PerformanceMonitor without an App ID (the default)', () => {
  for (const appId of ['', '   ']) {
    it(`should stay completely off for App ID "${appId}"`, async () => {
      const { client, loader } = configure(appId);
      const monitor = TestBed.inject(PerformanceMonitor);

      await monitor.start();
      monitor.recordApiCall('GET', `${SERVER}/api/me`, 200, 50);
      monitor.checkoutStarted('pay-now', 1);
      monitor.checkoutCompleted('pay-now', 1, 120);
      monitor.checkoutFailed('pay-now', 1, 120, 422);
      TestBed.inject(Auth).setCurrentUser({
        id: 3,
        username: 's',
        fullName: 'S',
        email: 's@x.test',
        pictureUrl: '',
        role: 'student',
        preferences: [],
      });
      TestBed.tick();

      expect(monitor.enabled).toBeFalse();
      expect(loader).not.toHaveBeenCalled(); // the SDK is never even downloaded
      expect(client.init).not.toHaveBeenCalled();
      expect(client.track).not.toHaveBeenCalled();
      expect(client.identify).not.toHaveBeenCalled();
    });
  }
});

describe('PerformanceMonitor with an App ID', () => {
  it('should load and initialise the SDK exactly once, with the privacy options', async () => {
    const { client, loader } = configure(APP_ID);
    const monitor = TestBed.inject(PerformanceMonitor);

    await monitor.start();
    await monitor.start();

    expect(monitor.enabled).toBeTrue();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(client.init).toHaveBeenCalledTimes(1);

    const [appId, options] = client.init.calls.mostRecent().args;
    expect(appId).toBe(APP_ID);
    expect(options.dom.textSanitizer).toBeTrue();
    expect(options.dom.inputSanitizer).toBeTrue();
    expect(options.network.requestSanitizer).toBe(sanitizeRequest);
    expect(options.network.responseSanitizer).toBe(sanitizeResponse);
  });

  it('should keep the app working when the SDK cannot be loaded', async () => {
    const { client } = configure(APP_ID);
    TestBed.overrideProvider(LOGROCKET_CLIENT_LOADER, {
      useValue: () => Promise.reject(new Error('offline')),
    });
    const monitor = TestBed.inject(PerformanceMonitor);

    await expectAsync(monitor.start()).toBeResolved();
    monitor.recordApiCall('GET', `${SERVER}/api/me`, 200, 50);

    expect(client.track).not.toHaveBeenCalled();
  });

  it('should keep the app working when LogRocket itself throws', async () => {
    const { client } = configure(APP_ID);
    const monitor = TestBed.inject(PerformanceMonitor);
    await monitor.start();
    client.track.and.throwError('LogRocket exploded');

    expect(() => monitor.recordApiCall('GET', `${SERVER}/api/me`, 200, 50)).not.toThrow();
    expect(() => monitor.checkoutStarted('pay-now', 1)).not.toThrow();
  });

  it('should identify the user by id and role only (never name, email or card)', async () => {
    const { client } = configure(APP_ID);
    const monitor = TestBed.inject(PerformanceMonitor);
    await monitor.start();

    TestBed.inject(Auth).setCurrentUser({
      id: 3,
      username: 'student',
      fullName: 'CampusCart Student',
      email: 'student@campuscart.com',
      pictureUrl: 'http://x.test/me.png',
      role: 'student',
      preferences: ['Books'],
      creditCardLast4: '9876',
    });
    TestBed.tick();

    expect(client.identify).toHaveBeenCalledOnceWith('3', { role: 'student' });
    expect(JSON.stringify(client.identify.calls.allArgs())).not.toMatch(
      /campuscart|student@|9876|Books/,
    );
  });

  it('should report an API call with a normalised endpoint, method, status and duration', async () => {
    const { client } = configure(APP_ID);
    const monitor = TestBed.inject(PerformanceMonitor);
    await monitor.start();

    monitor.recordApiCall('post', `${SERVER}/api/invoices/12/pay?x=1`, 200, 245.6);

    expect(client.track).toHaveBeenCalledOnceWith('API Response', {
      endpoint: '/api/invoices/:id/pay',
      method: 'POST',
      status: 200,
      duration_ms: 246,
      duration_bucket: '2) 100-300 ms',
    });
  });

  it('should cap API events per page load so LogRocket property limits are never exceeded', async () => {
    const { client } = configure(APP_ID);
    const monitor = TestBed.inject(PerformanceMonitor);
    await monitor.start();

    for (let i = 0; i < MAX_API_EVENTS_PER_PAGE_LOAD + 25; i++) {
      monitor.recordApiCall('GET', `${SERVER}/api/products`, 200, 30);
    }

    expect(client.track).toHaveBeenCalledTimes(MAX_API_EVENTS_PER_PAGE_LOAD);
  });

  it('should report the checkout events with only the payment option and line count', async () => {
    const { client } = configure(APP_ID);
    const monitor = TestBed.inject(PerformanceMonitor);
    await monitor.start();

    monitor.checkoutStarted('pay-now', 2);
    monitor.checkoutCompleted('pay-now', 2, 1520);
    monitor.checkoutFailed('add-to-invoice', 1, 80, 422);

    expect(client.track.calls.allArgs()).toEqual([
      ['Checkout Started', { payment_option: 'pay-now', line_items: 2 }],
      [
        'Checkout Completed',
        {
          payment_option: 'pay-now',
          line_items: 2,
          duration_ms: 1520,
          duration_bucket: '4) 1-3 s',
        },
      ],
      [
        'Checkout Failed',
        {
          payment_option: 'add-to-invoice',
          line_items: 1,
          duration_ms: 80,
          duration_bucket: '1) under 100 ms',
          status: 422,
        },
      ],
    ]);
  });

  it('should time route navigations from start to end (query string removed)', async () => {
    const { client } = configure(APP_ID, fakeClient(), tickingClock(50));
    const monitor = TestBed.inject(PerformanceMonitor);
    await monitor.start();

    await TestBed.inject(Router).navigateByUrl('/store?token=abc');

    expect(client.track.calls.allArgs()).toEqual([
      ['Route Navigation Started', { route: '/store' }],
      [
        'Route Navigation Completed',
        { route: '/store', duration_ms: 50, duration_bucket: '1) under 100 ms' },
      ],
    ]);
  });

  it('should not report a completion for a navigation that failed', async () => {
    const { client } = configure(APP_ID);
    const monitor = TestBed.inject(PerformanceMonitor);
    await monitor.start();

    await TestBed.inject(Router)
      .navigateByUrl('/no-such-page')
      .catch(() => undefined);

    const names = client.track.calls.allArgs().map((args) => args[0]);
    expect(names).toEqual(['Route Navigation Started']);
  });

  it('should only ever send a closed set of numeric and label properties (no user data)', async () => {
    const { client } = configure(APP_ID, fakeClient(), tickingClock(30));
    const monitor = TestBed.inject(PerformanceMonitor);
    await monitor.start();

    await TestBed.inject(Router).navigateByUrl('/store');
    monitor.recordApiCall('POST', `${SERVER}/api/login`, 200, 80);
    monitor.recordApiCall('GET', `${SERVER}/api/invoices/9?secret=1`, 403, 40);
    monitor.checkoutStarted('pay-now', 3);
    monitor.checkoutCompleted('pay-now', 3, 900);
    monitor.checkoutFailed('pay-now', 3, 900, 0);

    const allowedNames = [
      'Route Navigation Started',
      'Route Navigation Completed',
      'API Response',
      'Checkout Started',
      'Checkout Completed',
      'Checkout Failed',
    ];
    const allowedKeys = [
      'route',
      'duration_ms',
      'duration_bucket',
      'endpoint',
      'method',
      'status',
      'payment_option',
      'line_items',
    ];

    for (const [name, properties] of client.track.calls.allArgs()) {
      expect(allowedNames).toContain(name);
      for (const [key, value] of Object.entries(properties as Record<string, unknown>)) {
        expect(allowedKeys).toContain(key);
        expect(['number', 'string']).toContain(typeof value);
      }
    }
    expect(JSON.stringify(client.track.calls.allArgs())).not.toMatch(
      /secret|password|@|Bearer|XSRF/i,
    );
  });
});
