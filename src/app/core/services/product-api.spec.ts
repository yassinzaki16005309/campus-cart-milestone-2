import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ProductApi } from './product-api';
import { LOGROCKET_APP_ID_TOKEN } from '../config/logrocket.config';
import {
  LOGROCKET_CLIENT_LOADER,
  LogRocketClient,
  PERFORMANCE_CLOCK,
  PerformanceMonitor,
} from '../monitoring/performance-monitor';

const CHECKOUT = 'http://localhost:8000/api/checkout';
const ITEMS = [
  { productId: 1, quantity: 2 },
  { productId: 4, quantity: 1 },
];

describe('ProductApi.checkout (checkout completion time metric)', () => {
  let api: ProductApi;
  let controller: HttpTestingController;
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
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LOGROCKET_APP_ID_TOKEN, useValue: appId },
        {
          provide: LOGROCKET_CLIENT_LOADER,
          useValue: () => Promise.resolve(client as unknown as LogRocketClient),
        },
        { provide: PERFORMANCE_CLOCK, useValue: () => (now += 700) }, // checkout "takes" 700 ms
      ],
    });

    api = TestBed.inject(ProductApi);
    controller = TestBed.inject(HttpTestingController);
    await TestBed.inject(PerformanceMonitor).start();
  }

  afterEach(() => controller.verify());

  it('should report the start and the completion with the elapsed time', async () => {
    await setup('test-org/test-app');
    let result: unknown;

    api.checkout(ITEMS, 'pay-now').subscribe((value) => (result = value));
    controller
      .expectOne(CHECKOUT)
      .flush({ message: 'Payment successful! Your purchase total is EGP 900.' });

    expect(track.calls.allArgs()).toEqual([
      ['Checkout Started', { payment_option: 'pay-now', line_items: 2 }],
      [
        'Checkout Completed',
        {
          payment_option: 'pay-now',
          line_items: 2,
          duration_ms: 700,
          duration_bucket: '3) 300 ms-1 s',
        },
      ],
    ]);
    // the checkout itself behaves exactly as before
    expect(result).toEqual({ message: 'Payment successful! Your purchase total is EGP 900.' });
  });

  it('should still send only ids, quantities and the payment option to the server', async () => {
    await setup('test-org/test-app');

    api.checkout(ITEMS, 'add-to-invoice').subscribe();
    const request = controller.expectOne(CHECKOUT);

    expect(request.request.body).toEqual({ items: ITEMS, paymentOption: 'add-to-invoice' });
    request.flush({ message: 'ok' });
  });

  it('should report a refused checkout as failed, with its status, and pass the error on', async () => {
    await setup('test-org/test-app');
    let status = 0;

    api.checkout(ITEMS, 'pay-now').subscribe({ error: (error) => (status = error.status) });
    controller
      .expectOne(CHECKOUT)
      .flush(
        { message: 'Not enough stock available for Campus Hoodie.' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );

    expect(status).toBe(422);
    expect(track.calls.allArgs().map((args) => args[0])).toEqual([
      'Checkout Started',
      'Checkout Failed',
    ]);
    expect(track.calls.mostRecent().args[1]).toEqual(
      jasmine.objectContaining({
        payment_option: 'pay-now',
        line_items: 2,
        status: 422,
        duration_ms: 700,
      }),
    );
  });

  it('should never report products, prices, totals or messages', async () => {
    await setup('test-org/test-app');

    api.checkout(ITEMS, 'pay-now').subscribe();
    controller
      .expectOne(CHECKOUT)
      .flush({ message: 'Payment successful! Your purchase total is EGP 900.' });

    expect(JSON.stringify(track.calls.allArgs())).not.toMatch(
      /EGP|900|productId|Hoodie|Payment successful/,
    );
  });

  it('should start the clock when the checkout is subscribed to, not when it is created', async () => {
    await setup('test-org/test-app');

    api.checkout(ITEMS, 'pay-now'); // never subscribed

    expect(track).not.toHaveBeenCalled();
  });

  it('should behave exactly as before while monitoring is switched off', async () => {
    await setup('');
    let result: unknown;

    api.checkout(ITEMS, 'pay-now').subscribe((value) => (result = value));
    controller.expectOne(CHECKOUT).flush({ message: 'done' });

    expect(result).toEqual({ message: 'done' });
    expect(track).not.toHaveBeenCalled();
  });
});
