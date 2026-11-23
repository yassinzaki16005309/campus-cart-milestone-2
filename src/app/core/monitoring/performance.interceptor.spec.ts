import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import {
  LOGROCKET_CLIENT_LOADER,
  LogRocketClient,
  PERFORMANCE_CLOCK,
  PerformanceMonitor,
} from './performance-monitor';
import { performanceInterceptor } from './performance.interceptor';
import { LOGROCKET_APP_ID_TOKEN } from '../config/logrocket.config';

const SERVER = 'http://localhost:8000';

describe('performanceInterceptor (API response time)', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let monitor: PerformanceMonitor;
  let track: jasmine.Spy;

  async function setup(appId: string): Promise<void> {
    track = jasmine.createSpy('track');
    const client = {
      init: jasmine.createSpy('init'),
      track,
      identify: jasmine.createSpy('identify'),
    };
    let now = 0;

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([performanceInterceptor])),
        provideHttpClientTesting(),
        { provide: LOGROCKET_APP_ID_TOKEN, useValue: appId },
        {
          provide: LOGROCKET_CLIENT_LOADER,
          useValue: () => Promise.resolve(client as unknown as LogRocketClient),
        },
        { provide: PERFORMANCE_CLOCK, useValue: () => (now += 40) }, // every request "takes" 40 ms
      ],
    });

    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    monitor = TestBed.inject(PerformanceMonitor);
    await monitor.start();
  }

  afterEach(() => controller.verify());

  it('should report the duration of a successful API call', async () => {
    await setup('test-org/test-app');

    http.post(`${SERVER}/api/invoices/12/pay`, { secret: 'body-must-not-leak' }).subscribe();
    controller.expectOne(`${SERVER}/api/invoices/12/pay`).flush({ data: {} });

    expect(track).toHaveBeenCalledOnceWith('API Response', {
      endpoint: '/api/invoices/:id/pay',
      method: 'POST',
      status: 200,
      duration_ms: 40,
      duration_bucket: '1) under 100 ms',
    });
    expect(JSON.stringify(track.calls.allArgs())).not.toContain('body-must-not-leak');
  });

  it('should also report failed calls with their status', async () => {
    await setup('test-org/test-app');

    http
      .get(`${SERVER}/api/transactions?department=Bookstore`)
      .subscribe({ error: () => undefined });
    controller
      .expectOne(`${SERVER}/api/transactions?department=Bookstore`)
      .flush({ message: 'Server Error' }, { status: 500, statusText: 'Server Error' });

    expect(track).toHaveBeenCalledOnceWith(
      'API Response',
      jasmine.objectContaining({
        endpoint: '/api/transactions', // query string removed
        method: 'GET',
        status: 500,
      }),
    );
  });

  it('should report an unreachable server as status 0', async () => {
    await setup('test-org/test-app');

    http.get(`${SERVER}/api/products`).subscribe({ error: () => undefined });
    controller.expectOne(`${SERVER}/api/products`).error(new ProgressEvent('error'), { status: 0 });

    expect(track).toHaveBeenCalledOnceWith('API Response', jasmine.objectContaining({ status: 0 }));
  });

  it('should ignore requests to other servers', async () => {
    await setup('test-org/test-app');

    http.get('https://example.com/data').subscribe();
    controller.expectOne('https://example.com/data').flush({});

    expect(track).not.toHaveBeenCalled();
  });

  it('should do nothing at all while monitoring is switched off', async () => {
    await setup('');

    let received: unknown;
    http.get(`${SERVER}/api/products`).subscribe((body) => (received = body));
    controller.expectOne(`${SERVER}/api/products`).flush({ data: [1] });

    expect(received).toEqual({ data: [1] }); // the request itself is unaffected
    expect(track).not.toHaveBeenCalled();
  });
});
