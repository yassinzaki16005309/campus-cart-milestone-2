import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { apiInterceptor } from './api.interceptor';
import { Auth } from '../services/auth';

const SERVER = 'http://localhost:8000';

describe('apiInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let auth: Auth;
  let router: Router;

  const clearXsrfCookie = () => {
    document.cookie = 'XSRF-TOKEN=; max-age=0; path=/';
  };

  beforeEach(() => {
    clearXsrfCookie();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(Auth);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  afterEach(() => {
    controller.verify();
    clearXsrfCookie();
  });

  it('should send the session cookie and ask for JSON on API requests', () => {
    http.get(`${SERVER}/api/employees`).subscribe();

    const request = controller.expectOne(`${SERVER}/api/employees`);
    expect(request.request.withCredentials).toBeTrue();
    expect(request.request.headers.get('Accept')).toBe('application/json');
    request.flush({ data: [] });
  });

  it('should copy the XSRF-TOKEN cookie into the X-XSRF-TOKEN header on write requests', () => {
    document.cookie = 'XSRF-TOKEN=abc%3D%3D; path=/';

    http.post(`${SERVER}/api/employees`, {}).subscribe();

    const request = controller.expectOne(`${SERVER}/api/employees`);
    expect(request.request.headers.get('X-XSRF-TOKEN')).toBe('abc==');
    request.flush({});
  });

  it('should not add the XSRF header to read requests', () => {
    document.cookie = 'XSRF-TOKEN=abc; path=/';

    http.get(`${SERVER}/api/employees`).subscribe();

    const request = controller.expectOne(`${SERVER}/api/employees`);
    expect(request.request.headers.has('X-XSRF-TOKEN')).toBeFalse();
    request.flush({ data: [] });
  });

  it('should leave requests to other servers untouched', () => {
    document.cookie = 'XSRF-TOKEN=abc; path=/';

    http.post('https://example.com/collect', {}).subscribe();

    const request = controller.expectOne('https://example.com/collect');
    expect(request.request.withCredentials).toBeFalse();
    expect(request.request.headers.has('X-XSRF-TOKEN')).toBeFalse();
    request.flush({});
  });

  it('should log the user out and open the login page when the server session has ended (401)', () => {
    auth.setCurrentUser({
      id: 3,
      username: 'student',
      fullName: 'CampusCart Student',
      email: 'student@campuscart.com',
      pictureUrl: '',
      role: 'student',
      preferences: [],
    });

    http.get(`${SERVER}/api/invoices`).subscribe({ error: () => undefined });

    controller
      .expectOne(`${SERVER}/api/invoices`)
      .flush({ message: 'Unauthenticated.' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.isLoggedIn()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should not treat a failed login as an expired session', () => {
    http.post(`${SERVER}/api/login`, {}).subscribe({ error: () => undefined });

    controller
      .expectOne(`${SERVER}/api/login`)
      .flush(
        { message: 'Invalid username or password.' },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should pass other errors (403, 409, 422) through to the page so it can show the message', () => {
    let status = 0;

    http
      .delete(`${SERVER}/api/transactions/1`)
      .subscribe({ error: (error) => (status = error.status) });

    controller.expectOne(`${SERVER}/api/transactions/1`).flush(
      {
        message:
          'This transaction was created by a store purchase and cannot be modified or deleted.',
      },
      { status: 409, statusText: 'Conflict' },
    );

    expect(status).toBe(409);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 419: Laravel checks the CSRF token BEFORE it checks the login. When the
  // server session has expired, every write answers 419 instead of 401, so a 419
  // is ambiguous. The interceptor resolves it: refresh the CSRF cookie, ask
  // GET /api/me (the authoritative answer), then either log out (401) or retry once.
  // ---------------------------------------------------------------------------
  describe('419 (CSRF token mismatch)', () => {
    const USER = {
      id: 3,
      username: 'student',
      fullName: 'CampusCart Student',
      email: 'student@campuscart.com',
      pictureUrl: '',
      role: 'student' as const,
      preferences: [],
    };
    const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;
    const TARGET = `${SERVER}/api/invoices/1`;
    const CSRF_COOKIE = `${SERVER}/sanctum/csrf-cookie`;
    const ME = `${SERVER}/api/me`;
    const MISMATCH = {
      message: 'Your request could not be verified.',
      code: 'csrf_token_mismatch',
    };

    /** Sends a write request and records what the page that sent it would receive. */
    function send(method: string) {
      const outcome: { value?: unknown; error?: HttpErrorResponse } = {};
      http.request(method, TARGET, { body: {} }).subscribe({
        next: (value) => (outcome.value = value),
        error: (error) => (outcome.error = error),
      });
      return outcome;
    }

    const reject419 = (method: string, token?: string) => {
      const request = controller.expectOne((r) => r.url === TARGET && r.method === method);
      if (token !== undefined) {
        expect(request.request.headers.get('X-XSRF-TOKEN')).toBe(token);
      }
      request.flush(MISMATCH, { status: 419, statusText: 'Page Expired' });
    };

    /** Answers GET /sanctum/csrf-cookie like the server does: a new XSRF-TOKEN cookie. */
    const refreshCsrfCookie = () => {
      controller.expectOne(CSRF_COOKIE).flush(null, { status: 204, statusText: 'No Content' });
      document.cookie = 'XSRF-TOKEN=fresh-token; path=/';
    };

    beforeEach(() => {
      auth.setCurrentUser(USER);
      document.cookie = 'XSRF-TOKEN=stale-token; path=/';
    });

    for (const method of WRITE_METHODS) {
      it(`${method}: should log the user out and open the login page when the session has expired`, () => {
        const outcome = send(method);

        reject419(method, 'stale-token');
        refreshCsrfCookie();
        controller
          .expectOne(ME)
          .flush({ message: 'Unauthenticated.' }, { status: 401, statusText: 'Unauthorized' });

        // the session really is gone: no misleading logged-in state, user goes to login
        expect(auth.isLoggedIn()).toBeFalse();
        expect(router.navigate).toHaveBeenCalledWith(['/login']);
        // and the request is NOT repeated against a dead session
        controller.expectNone((r) => r.url === TARGET);
        expect(outcome.error?.status).toBe(419);
      });

      it(`${method}: should refresh the token and retry once when only the token was stale`, () => {
        const outcome = send(method);

        reject419(method, 'stale-token');
        refreshCsrfCookie();
        controller.expectOne(ME).flush({ data: USER });

        // the retry carries the NEW token and succeeds
        const retry = controller.expectOne((r) => r.url === TARGET && r.method === method);
        expect(retry.request.headers.get('X-XSRF-TOKEN')).toBe('fresh-token');
        retry.flush({ data: { id: 1 } });

        expect(outcome.value).toEqual({ data: { id: 1 } });
        expect(outcome.error).toBeUndefined();
        expect(auth.isLoggedIn()).toBeTrue();
        expect(router.navigate).not.toHaveBeenCalled();
      });

      it(`${method}: should keep the user logged in and show the message when the mismatch persists`, () => {
        const outcome = send(method);

        reject419(method, 'stale-token');
        refreshCsrfCookie();
        controller.expectOne(ME).flush({ data: USER });
        reject419(method, 'fresh-token'); // a genuine mismatch: still rejected after the refresh

        // exactly one retry (verify() in afterEach proves there is no endless loop)
        expect(outcome.error?.status).toBe(419);
        expect(outcome.error?.error.message).toBe('Your request could not be verified.');
        // a CSRF failure with a valid session is NOT an expired session
        expect(auth.isLoggedIn()).toBeTrue();
        expect(router.navigate).not.toHaveBeenCalled();
      });
    }

    it('should not log the user out or retry when the session check cannot be completed', () => {
      const outcome = send('POST');

      reject419('POST');
      refreshCsrfCookie();
      controller
        .expectOne(ME)
        .flush({ message: 'Server Error' }, { status: 500, statusText: 'Server Error' });

      expect(outcome.error?.status).toBe(419); // the page still gets the original failure
      expect(auth.isLoggedIn()).toBeTrue();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('should not log the user out or retry when the CSRF cookie cannot be refreshed', () => {
      const outcome = send('DELETE');

      reject419('DELETE');
      controller.expectOne(CSRF_COOKIE).error(new ProgressEvent('error'), { status: 0 });

      expect(outcome.error?.status).toBe(419);
      expect(auth.isLoggedIn()).toBeTrue();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('should leave a 419 on login/register alone (they fetch a fresh CSRF cookie themselves)', () => {
      let status = 0;
      http.post(`${SERVER}/api/login`, {}).subscribe({ error: (error) => (status = error.status) });

      controller
        .expectOne(`${SERVER}/api/login`)
        .flush(MISMATCH, { status: 419, statusText: 'Page Expired' });

      expect(status).toBe(419);
      // no recovery requests were made (verify() in afterEach)
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('should log out when the session ends between the 419 and the retry', () => {
      const outcome = send('POST');

      reject419('POST');
      refreshCsrfCookie();
      controller.expectOne(ME).flush({ data: USER });
      controller
        .expectOne((r) => r.url === TARGET)
        .flush({ message: 'Unauthenticated.' }, { status: 401, statusText: 'Unauthorized' });

      expect(outcome.error?.status).toBe(401);
      expect(auth.isLoggedIn()).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });
  });
});
