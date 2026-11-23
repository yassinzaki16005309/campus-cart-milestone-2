import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, defer, map, tap } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { Product } from '../models/product.model';
import { PerformanceMonitor } from '../monitoring/performance-monitor';

export type CheckoutOption = 'pay-now' | 'add-to-invoice';

export interface CheckoutItem {
  productId: number;
  quantity: number;
}

export interface CheckoutResult {
  /** Success text from the server, e.g. "Payment successful! ..." */
  message: string;
}

/** Campus store REST API (admin + student). */
@Injectable({ providedIn: 'root' })
export class ProductApi {
  private http = inject(HttpClient);
  private monitor = inject(PerformanceMonitor);
  private baseUrl = `${inject(API_BASE_URL)}/api`;

  list(): Observable<Product[]> {
    return this.http
      .get<{ data: Product[] }>(`${this.baseUrl}/products`)
      .pipe(map((res) => res.data));
  }

  /**
   * Only ids, quantities and the payment option are sent. The server computes
   * prices and totals, checks and decrements stock, and creates exactly one
   * invoice or income record in a single database transaction.
   *
   * Performance metric 3 (checkout completion time): "Checkout Started" is reported when
   * the request begins and "Checkout Completed" / "Checkout Failed" when the answer arrives.
   * Only the payment option and the number of lines are reported, never products or prices.
   */
  checkout(items: CheckoutItem[], paymentOption: CheckoutOption): Observable<CheckoutResult> {
    return defer(() => {
      const startedAt = this.monitor.now();
      this.monitor.checkoutStarted(paymentOption, items.length);

      return this.http
        .post<{ message: string }>(`${this.baseUrl}/checkout`, { items, paymentOption })
        .pipe(
          tap({
            next: () =>
              this.monitor.checkoutCompleted(
                paymentOption,
                items.length,
                this.monitor.now() - startedAt,
              ),
            error: (error: HttpErrorResponse) =>
              this.monitor.checkoutFailed(
                paymentOption,
                items.length,
                this.monitor.now() - startedAt,
                error.status,
              ),
          }),
          map((res) => ({ message: res.message })),
        );
    });
  }
}
