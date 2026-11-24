import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Auth } from './auth';
import { User } from '../models/user.model';

const SERVER = 'http://localhost:8000';

const STUDENT: User = {
  id: 3,
  username: 'student',
  fullName: 'CampusCart Student',
  email: 'student@campuscart.com',
  pictureUrl: '',
  role: 'student',
  preferences: [],
};

describe('Auth', () => {
  let auth: Auth;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    auth = TestBed.inject(Auth);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // Answers the CSRF-cookie request that precedes login/register
  function answerCsrfCookie(): void {
    http
      .expectOne(`${SERVER}/sanctum/csrf-cookie`)
      .flush(null, { status: 204, statusText: 'No Content' });
  }

  it('should be created and start logged out', () => {
    expect(auth).toBeTruthy();
    expect(auth.isLoggedIn()).toBeFalse();
    expect(auth.currentUser()).toBeNull();
  });

  // SESSION RESTORE (page reload)
  it('should restore the logged-in user from the server session', async () => {
    const restored = auth.restoreSession();

    http.expectOne(`${SERVER}/api/me`).flush({ data: STUDENT });
    await restored;

    expect(auth.isLoggedIn()).toBeTrue();
    expect(auth.currentUser()).toEqual(STUDENT);
  });

  it('should stay logged out when the server has no session (and still resolve)', async () => {
    const restored = auth.restoreSession();

    http
      .expectOne(`${SERVER}/api/me`)
      .flush({ message: 'Unauthenticated.' }, { status: 401, statusText: 'Unauthorized' });
    await restored;

    expect(auth.isLoggedIn()).toBeFalse();
  });

  it('should stay logged out when the server cannot be reached (and still resolve)', async () => {
    const restored = auth.restoreSession();

    http.expectOne(`${SERVER}/api/me`).error(new ProgressEvent('error'), { status: 0 });
    await restored;

    expect(auth.isLoggedIn()).toBeFalse();
  });

  // LOGIN
  it('should login: fetch the CSRF cookie, then post the credentials', () => {
    let result: User | undefined;

    auth.login('student', 'Student123', true).subscribe((user) => (result = user));

    answerCsrfCookie();
    const request = http.expectOne(`${SERVER}/api/login`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      username: 'student',
      password: 'Student123',
      rememberMe: true,
    });
    request.flush({ data: STUDENT });

    expect(result).toEqual(STUDENT);
    expect(auth.isLoggedIn()).toBeTrue();
    expect(auth.currentUser()?.role).toBe('student');
  });

  it('should take the role from the server (admin)', () => {
    auth.login('admin', 'Admin123').subscribe();

    answerCsrfCookie();
    http
      .expectOne(`${SERVER}/api/login`)
      .flush({ data: { ...STUDENT, id: 1, username: 'admin', role: 'admin' } });

    expect(auth.currentUser()?.role).toBe('admin');
  });

  it('should reject invalid credentials and stay logged out', () => {
    let failure: HttpErrorResponse | undefined;

    auth.login('admin', 'WrongPassword').subscribe({ error: (error) => (failure = error) });

    answerCsrfCookie();
    http
      .expectOne(`${SERVER}/api/login`)
      .flush(
        { message: 'Invalid username or password.' },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(failure?.status).toBe(401);
    expect(failure?.error.message).toBe('Invalid username or password.');
    expect(auth.isLoggedIn()).toBeFalse();
  });

  // SIGNUP
  it('should register: send the profile and only the last 4 card digits', () => {
    let result: User | undefined;

    auth
      .register(
        {
          username: 'newstudent',
          fullName: 'New Student',
          email: 'new@example.com',
          pictureUrl: '',
          role: 'student',
          preferences: ['Books'],
          creditCardLast4: '1234',
        },
        'Secret123',
      )
      .subscribe((user) => (result = user));

    answerCsrfCookie();
    const request = http.expectOne(`${SERVER}/api/register`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      username: 'newstudent',
      fullName: 'New Student',
      email: 'new@example.com',
      pictureUrl: '',
      password: 'Secret123',
      creditCard: '1234',
      preferences: ['Books'],
    });
    // the role is never sent: the server always creates a student
    expect(request.request.body.role).toBeUndefined();
    request.flush({ data: { ...STUDENT, id: 9, username: 'newstudent' } });

    expect(result?.username).toBe('newstudent');
    expect(auth.isLoggedIn()).toBeTrue();
  });

  it('should reject a duplicate registration and stay logged out', () => {
    let failure: HttpErrorResponse | undefined;

    auth
      .register(
        {
          username: 'student',
          fullName: 'X',
          email: 'x@example.com',
          pictureUrl: '',
          role: 'student',
          preferences: [],
        },
        'Secret123',
      )
      .subscribe({ error: (error) => (failure = error) });

    answerCsrfCookie();
    http
      .expectOne(`${SERVER}/api/register`)
      .flush(
        { message: 'Username or email already exists, or password is invalid.' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );

    expect(failure?.status).toBe(422);
    expect(auth.isLoggedIn()).toBeFalse();
  });

  // LOGOUT
  it('should logout on the server and clear the current user', () => {
    auth.setCurrentUser(STUDENT);

    auth.logout().subscribe();

    const request = http.expectOne(`${SERVER}/api/logout`);
    expect(request.request.method).toBe('POST');
    request.flush({ message: 'Logged out successfully.' });

    expect(auth.isLoggedIn()).toBeFalse();
    expect(auth.currentUser()).toBeNull();
  });

  it('should clear the current user even when the server cannot be reached', () => {
    auth.setCurrentUser(STUDENT);

    auth.logout().subscribe();

    http.expectOne(`${SERVER}/api/logout`).error(new ProgressEvent('error'), { status: 0 });

    expect(auth.isLoggedIn()).toBeFalse();
  });

  // UPDATE PROFILE
  it('should update the profile through PUT /api/profile and keep the returned user', () => {
    auth.setCurrentUser(STUDENT);
    let message: string | undefined;

    auth
      .updateProfile({ fullName: 'Renamed Student', pictureUrl: null, creditCard: '9876' })
      .subscribe((result) => (message = result));

    const request = http.expectOne(`${SERVER}/api/profile`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      fullName: 'Renamed Student',
      pictureUrl: null,
      creditCard: '9876',
    });
    request.flush({
      data: { ...STUDENT, fullName: 'Renamed Student', creditCardLast4: '9876' },
      message: 'Profile updated successfully.',
    });

    expect(message).toBe('Profile updated successfully.');
    expect(auth.currentUser()?.fullName).toBe('Renamed Student');
    expect(auth.currentUser()?.creditCardLast4).toBe('9876');
  });

  it('should keep the current user when the profile update is rejected', () => {
    auth.setCurrentUser(STUDENT);
    let failure: HttpErrorResponse | undefined;

    auth
      .updateProfile({ email: 'taken@campuscart.com' })
      .subscribe({ error: (error) => (failure = error) });

    http
      .expectOne(`${SERVER}/api/profile`)
      .flush(
        { message: 'This email is already used by another account.' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );

    expect(failure?.status).toBe(422);
    expect(auth.currentUser()).toEqual(STUDENT);
  });

  // DELETE ACCOUNT
  it('should delete the account, log the user out locally and leave a one-time notice', () => {
    auth.setCurrentUser(STUDENT);
    let message: string | undefined;

    auth.deleteProfile().subscribe((result) => (message = result));

    const request = http.expectOne(`${SERVER}/api/profile`);
    expect(request.request.method).toBe('DELETE');
    request.flush({ message: 'Your account has been deleted.' });

    expect(message).toBe('Your account has been deleted.');
    expect(auth.isLoggedIn()).toBeFalse();
    expect(auth.notice()).toBe('Your account has been deleted.');

    auth.clearNotice();
    expect(auth.notice()).toBe('');
  });

  it('should stay logged in, with no notice, when the server refuses to delete the account', () => {
    auth.setCurrentUser(STUDENT);
    let failure: HttpErrorResponse | undefined;

    auth.deleteProfile().subscribe({ error: (error) => (failure = error) });

    http.expectOne(`${SERVER}/api/profile`).flush(
      {
        message: 'You still have unpaid invoices. Please pay them before deleting your account.',
        code: 'unpaid_invoices',
      },
      { status: 409, statusText: 'Conflict' },
    );

    expect(failure?.status).toBe(409);
    expect(auth.currentUser()).toEqual(STUDENT);
    expect(auth.notice()).toBe('');
  });

  // ROLES
  it('should check a single role', () => {
    auth.setCurrentUser(STUDENT);

    expect(auth.hasRole('student')).toBeTrue();
    expect(auth.hasRole('admin')).toBeFalse();
  });

  it('should check a list of roles', () => {
    auth.setCurrentUser({ ...STUDENT, role: 'accountant' });

    expect(auth.hasRole(['admin', 'accountant'])).toBeTrue();
    expect(auth.hasRole(['admin', 'student'])).toBeFalse();
  });

  it('should deny every role when nobody is logged in', () => {
    expect(auth.hasRole('student')).toBeFalse();
    expect(auth.hasRole(['admin', 'accountant', 'student'])).toBeFalse();
  });

  // PRIVACY: the login lives on the server, not in the browser
  it('should not keep the user, any account or any password in browser storage', () => {
    auth.login('student', 'Student123').subscribe();

    answerCsrfCookie();
    http.expectOne(`${SERVER}/api/login`).flush({ data: STUDENT });

    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
  });
});
