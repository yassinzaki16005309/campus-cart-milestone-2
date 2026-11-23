import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, firstValueFrom, map, of, switchMap, tap } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { User, UserRole } from '../models/user.model';

/**
 * Authentication against the Laravel API (Sanctum cookie session).
 *
 * The server owns the session: nothing about the login (no user object, no
 * password) is kept in browser storage any more. After a page reload the session
 * is restored once, before the first render, by restoreSession().
 */
@Injectable({
  providedIn: 'root',
})
export class Auth {
  private http = inject(HttpClient);
  private baseUrl = inject(API_BASE_URL);

  private currentUserSignal = signal<User | null>(null);

  currentUser = this.currentUserSignal.asReadonly();

  isLoggedIn = computed(() => this.currentUserSignal() !== null);

  // RESTORE SESSION (called once at start-up)
  // Resolves in every case: a failed request simply means "not logged in".
  restoreSession(): Promise<void> {
    return firstValueFrom(
      this.http.get<{ data: User }>(`${this.baseUrl}/api/me`).pipe(
        tap((response) => this.currentUserSignal.set(response.data)),
        catchError(() => {
          this.currentUserSignal.set(null);
          return of(null);
        }),
      ),
    ).then(() => undefined);
  }

  // LOGIN
  login(username: string, password: string, rememberMe = false): Observable<User> {
    return this.csrfCookie().pipe(
      switchMap(() =>
        this.http.post<{ data: User }>(`${this.baseUrl}/api/login`, {
          username,
          password,
          rememberMe,
        }),
      ),
      map((response) => response.data),
      tap((user) => this.currentUserSignal.set(user)),
    );
  }

  // SIGNUP
  // The server always creates a student. Only the LAST 4 digits of the card
  // (computed by the signup form) are sent: the full number never leaves the browser.
  register(userData: Omit<User, 'id'>, password: string): Observable<User> {
    return this.csrfCookie().pipe(
      switchMap(() =>
        this.http.post<{ data: User }>(`${this.baseUrl}/api/register`, {
          username: userData.username,
          fullName: userData.fullName,
          email: userData.email,
          pictureUrl: userData.pictureUrl,
          password,
          creditCard: userData.creditCardLast4 ?? null,
          preferences: userData.preferences,
        }),
      ),
      map((response) => response.data),
      tap((user) => this.currentUserSignal.set(user)),
    );
  }

  // LOGOUT
  // The local state is cleared even if the server cannot be reached.
  logout(): Observable<void> {
    return this.http.post(`${this.baseUrl}/api/logout`, {}).pipe(
      catchError(() => of(null)),
      tap(() => this.currentUserSignal.set(null)),
      map(() => undefined),
    );
  }

  // SET CURRENT USER (used after login/registration, when the session expires, and in tests)
  setCurrentUser(user: User | null): void {
    this.currentUserSignal.set(user);
  }

  // CHECK USER ROLE
  hasRole(roles: UserRole | UserRole[]): boolean {
    const user = this.currentUserSignal();

    if (!user) {
      return false;
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    return allowedRoles.includes(user.role);
  }

  // Asks Laravel for the XSRF-TOKEN cookie that protects login/register (CSRF).
  private csrfCookie(): Observable<unknown> {
    return this.http.get(`${this.baseUrl}/sanctum/csrf-cookie`);
  }
}
