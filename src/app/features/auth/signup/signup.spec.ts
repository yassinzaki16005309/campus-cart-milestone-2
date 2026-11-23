import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { Signup } from './signup';
import { User } from '../../../core/models/user.model';

const SERVER = 'http://localhost:8000';

const NEW_USER: User = {
  id: 9,
  username: 'newstudent',
  fullName: 'New Student',
  email: 'new@example.com',
  pictureUrl: '',
  role: 'student',
  preferences: ['Books'],
  creditCardLast4: '1234',
};

describe('Signup', () => {
  let component: Signup;
  let fixture: ComponentFixture<Signup>;
  let http: HttpTestingController;
  let router: Router;

  function fillForm(): void {
    component.username = 'newstudent';
    component.fullName = 'New Student';
    component.email = 'new@example.com';
    component.password = 'Secret123';
    component.creditCard = '4111 1111 1111 1234';
    component.preferences = ['Books'];
  }

  function answerCsrfCookie(): void {
    http
      .expectOne(`${SERVER}/sanctum/csrf-cookie`)
      .flush(null, { status: 204, statusText: 'No Content' });
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Signup],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);

    fixture = TestBed.createComponent(Signup);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should add and remove a preference', () => {
    component.togglePreference('Books');
    expect(component.preferences).toEqual(['Books']);

    component.togglePreference('Books');
    expect(component.preferences).toEqual([]);
  });

  it('should send only the last 4 card digits and go to the profile page', () => {
    fillForm();

    component.signup();

    answerCsrfCookie();
    const request = http.expectOne(`${SERVER}/api/register`);
    expect(request.request.body.creditCard).toBe('1234');
    // the full card number never leaves the browser
    expect(JSON.stringify(request.request.body)).not.toContain('4111');
    request.flush({ data: NEW_USER });

    expect(router.navigate).toHaveBeenCalledWith(['/profile']);
  });

  it('should send no card when fewer than 4 digits were typed', () => {
    fillForm();
    component.creditCard = '12';

    component.signup();

    answerCsrfCookie();
    const request = http.expectOne(`${SERVER}/api/register`);
    expect(request.request.body.creditCard).toBeNull();
    request.flush({ data: { ...NEW_USER, creditCardLast4: null } });
  });

  it('should show the server message when the username or email already exists', () => {
    fillForm();

    component.signup();

    answerCsrfCookie();
    http
      .expectOne(`${SERVER}/api/register`)
      .flush(
        { message: 'Username or email already exists, or password is invalid.' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );

    expect(component.errorMessage).toBe(
      'Username or email already exists, or password is invalid.',
    );
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
