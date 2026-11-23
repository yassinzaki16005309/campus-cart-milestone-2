import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { Invoice } from '../models/invoice.model';

export interface InvoiceInput {
  description: string;
  amount: number;
  dueDate: string;
}

/** Student fees REST API. Students only ever receive their own invoices. */
@Injectable({ providedIn: 'root' })
export class InvoiceApi {
  private http = inject(HttpClient);
  private url = `${inject(API_BASE_URL)}/api/invoices`;

  list(): Observable<Invoice[]> {
    return this.http.get<{ data: Invoice[] }>(this.url).pipe(map((res) => res.data));
  }

  create(invoice: InvoiceInput): Observable<Invoice> {
    return this.http.post<{ data: Invoice }>(this.url, invoice).pipe(map((res) => res.data));
  }

  /**
   * Marks the invoice as paid. For store purchases the server also records the
   * Bookstore income, exactly once.
   */
  pay(id: number): Observable<Invoice> {
    return this.http
      .post<{ data: Invoice }>(`${this.url}/${id}/pay`, {})
      .pipe(map((res) => res.data));
  }

  remove(id: number): Observable<void> {
    return this.http.delete(`${this.url}/${id}`).pipe(map(() => undefined));
  }
}
