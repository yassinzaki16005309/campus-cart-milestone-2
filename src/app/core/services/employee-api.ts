import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { Employee } from '../models/employee.model';

export type EmployeeInput = Omit<Employee, 'id'>;

/** Payroll REST API (admin + accountant). */
@Injectable({ providedIn: 'root' })
export class EmployeeApi {
  private http = inject(HttpClient);
  private url = `${inject(API_BASE_URL)}/api/employees`;

  list(): Observable<Employee[]> {
    return this.http.get<{ data: Employee[] }>(this.url).pipe(map((res) => res.data));
  }

  create(employee: EmployeeInput): Observable<Employee> {
    return this.http.post<{ data: Employee }>(this.url, employee).pipe(map((res) => res.data));
  }

  update(id: number, employee: EmployeeInput): Observable<Employee> {
    return this.http
      .put<{ data: Employee }>(`${this.url}/${id}`, employee)
      .pipe(map((res) => res.data));
  }

  remove(id: number): Observable<void> {
    return this.http.delete(`${this.url}/${id}`).pipe(map(() => undefined));
  }
}
