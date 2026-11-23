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
