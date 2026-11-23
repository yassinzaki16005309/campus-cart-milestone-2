import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { Transaction } from '../models/transaction.model';

export type TransactionInput = Omit<Transaction, 'id'>;

/** Department budget REST API (admin + accountant). */
@Injectable({ providedIn: 'root' })
export class TransactionApi {
  private http = inject(HttpClient);
  private url = `${inject(API_BASE_URL)}/api/transactions`;

  list(): Observable<Transaction[]> {
    return this.http.get<{ data: Transaction[] }>(this.url).pipe(map((res) => res.data));
  }

  create(transaction: TransactionInput): Observable<Transaction> {
    return this.http
      .post<{ data: Transaction }>(this.url, transaction)
      .pipe(map((res) => res.data));
  }

  update(id: number, transaction: Partial<TransactionInput>): Observable<Transaction> {
    return this.http
      .put<{ data: Transaction }>(`${this.url}/${id}`, transaction)
      .pipe(map((res) => res.data));
  }

  /** The server answers 409 for store income (read-only). */
  remove(id: number): Observable<void> {
    return this.http.delete(`${this.url}/${id}`).pipe(map(() => undefined));
  }
}
