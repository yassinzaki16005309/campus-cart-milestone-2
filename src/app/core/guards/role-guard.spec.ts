import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';

import { roleGuard } from './role-guard';
import { Auth } from '../services/auth';
import { User, UserRole } from '../models/user.model';

describe('roleGuard', () => {
  let auth: Auth;
  let router: Router;

  const userWithRole = (role: UserRole): User => ({
    id: 1,
    username: role,
    fullName: `CampusCart ${role}`,
    email: `${role}@campuscart.com`,
    pictureUrl: '',
    role,
    preferences: [],
  });

  const executeGuard = (roles: string[]): boolean | UrlTree => {
    const route = new ActivatedRouteSnapshot();
    route.data = { roles };

    const state = { url: '/payroll' } as RouterStateSnapshot;

    return TestBed.runInInjectionContext(() => roleGuard(route, state)) as boolean | UrlTree;
  };

  const redirectTarget = (result: boolean | UrlTree): string =>
    router.serializeUrl(result as UrlTree);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });

    auth = TestBed.inject(Auth);
    router = TestBed.inject(Router);
  });

  it('should send visitors who are not logged in to the login page', () => {
    expect(redirectTarget(executeGuard(['admin', 'accountant']))).toBe('/login');
  });

  it('should allow an admin to access admin pages', () => {
    auth.setCurrentUser(userWithRole('admin'));
    expect(executeGuard(['admin', 'accountant'])).toBeTrue();
  });

  it('should allow an accountant to access permitted pages', () => {
    auth.setCurrentUser(userWithRole('accountant'));
    expect(executeGuard(['admin', 'accountant'])).toBeTrue();
  });

  it('should allow a student to access student pages', () => {
    auth.setCurrentUser(userWithRole('student'));
    expect(executeGuard(['admin', 'student'])).toBeTrue();
  });

  it('should send a student away from staff pages (payroll, budget)', () => {
    auth.setCurrentUser(userWithRole('student'));
    expect(redirectTarget(executeGuard(['admin', 'accountant']))).toBe('/');
  });

  it('should send an accountant away from the store', () => {
    auth.setCurrentUser(userWithRole('accountant'));
    expect(redirectTarget(executeGuard(['admin', 'student']))).toBe('/');
  });

  // FEEDBACK: a refusal is explained, not silent
  it('should explain to a student why payroll is not available', () => {
    auth.setCurrentUser(userWithRole('student'));

    expect(redirectTarget(executeGuard(['admin', 'accountant']))).toBe('/');

    expect(auth.notice()).toBe('Your student account does not have access to that page.');
    expect(auth.noticeKind()).toBe('error');
  });

  it('should name the role of the user who was refused', () => {
    auth.setCurrentUser(userWithRole('accountant'));

    executeGuard(['admin', 'student']);

    expect(auth.notice()).toBe('Your accountant account does not have access to that page.');
  });

  it('should leave no notice when access is allowed', () => {
    auth.setCurrentUser(userWithRole('admin'));

    expect(executeGuard(['admin', 'accountant'])).toBeTrue();

    expect(auth.notice()).toBe('');
  });

  it('should leave no access notice for a visitor who is simply sent to the login page', () => {
    expect(redirectTarget(executeGuard(['admin']))).toBe('/login');

    expect(auth.notice()).toBe('');
  });

  it('should allow every role on pages open to all logged-in users', () => {
    for (const role of ['admin', 'accountant', 'student'] as UserRole[]) {
      auth.setCurrentUser(userWithRole(role));
      expect(executeGuard(['admin', 'accountant', 'student'])).toBeTrue();
    }
  });

  it('should lock the user out again after the session ends', () => {
    auth.setCurrentUser(userWithRole('admin'));
    expect(executeGuard(['admin'])).toBeTrue();

    auth.setCurrentUser(null);
    expect(redirectTarget(executeGuard(['admin']))).toBe('/login');
  });
});
