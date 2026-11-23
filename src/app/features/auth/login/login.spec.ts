import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { Login, REMEMBER_COOKIE } from './login';
import { Storage } from '../../../core/services/storage';
import { User } from '../../../core/models/user.model';

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

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let storage: Storage;
  let http: HttpTestingController;
  let router: Router;

  async function createComponent(): Promise<void> {
    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  // Plays the two requests every login makes: CSRF cookie, then the login itself
  function answerLogin(response: () => void): void {
    http
      .expectOne(`${SERVER}/sanctum/csrf-cookie`)
      .flush(null, { status: 204, statusText: 'No Content' });
    response();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    storage = TestBed.inject(Storage);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);

    storage.deleteCookie(REMEMBER_COOKIE);
    sessionStorage.clear();
  });

  afterEach(() => {
    http.verify();
    storage.deleteCookie(REMEMBER_COOKIE);
    sessionStorage.clear();
  });

  it('should create', async () => {
    await createComponent();
    expect(component).toBeTruthy();
  });

  it('should pre-fill the username from the cookie the server created', async () => {
    // The server sends this cookie after a login with "Remember me" (simulated here)
    storage.setCookie(REMEMBER_COOKIE, 'admin', 30);

    await createComponent();

    expect(component.username).toBe('admin');
    expect(component.rememberMe).toBeTrue();
  });

  it('should send the "Remember me" choice to the server and go to the profile', async () => {
    await createComponent();
    component.username = 'student';
    component.password = 'Student123';
    component.rememberMe = true;

    component.login();

    answerLogin(() => {
      const request = http.expectOne(`${SERVER}/api/login`);
      expect(request.request.body).toEqual({
        username: 'student',
        password: 'Student123',
        rememberMe: true,
      });
      request.flush({ data: STUDENT });
    });

    expect(router.navigate).toHaveBeenCalledWith(['/profile']);
  });

  it('should leave the cookie to the server (the browser no longer creates it)', async () => {
    await createComponent();
    component.username = 'student';
    component.password = 'Student123';
    component.rememberMe = true;

    component.login();
    answerLogin(() => http.expectOne(`${SERVER}/api/login`).flush({ data: STUDENT }));

    // In the real app the server's Set-Cookie header creates it; here nothing did.
    expect(storage.getCookie(REMEMBER_COOKIE)).toBeNull();
  });

  it('should show the server message and stay on the page when login fails', async () => {
    await createComponent();
    component.username = 'student';
    component.password = 'wrong';
    component.rememberMe = true;

    component.login();

    answerLogin(() =>
      http
        .expectOne(`${SERVER}/api/login`)
        .flush(
          { message: 'Invalid username or password.', code: 'invalid_credentials' },
          { status: 401, statusText: 'Unauthorized' },
        ),
    );

    expect(component.errorMessage).toBe('Invalid username or password.');
    expect(router.navigate).not.toHaveBeenCalled();
    expect(storage.getCookie(REMEMBER_COOKIE)).toBeNull();
  });

  it('should show a connection message when the server cannot be reached', async () => {
    await createComponent();
    component.username = 'student';
    component.password = 'Student123';

    component.login();

    http
      .expectOne(`${SERVER}/sanctum/csrf-cookie`)
      .error(new ProgressEvent('error'), { status: 0 });

    expect(component.errorMessage).toBe(
      'Cannot reach the server. Please check your connection and try again.',
    );
  });
});
