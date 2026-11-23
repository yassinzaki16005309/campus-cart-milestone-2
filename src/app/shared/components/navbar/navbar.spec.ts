import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { Navbar } from './navbar';
import { Auth } from '../../../core/services/auth';

describe('Navbar', () => {
  let component: Navbar;
  let fixture: ComponentFixture<Navbar>;
  let http: HttpTestingController;
  let router: Router;
  let auth: Auth;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    auth = TestBed.inject(Auth);
    spyOn(router, 'navigate').and.resolveTo(true);

    fixture = TestBed.createComponent(Navbar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should end the server session, clear the user and go to the login page on logout', () => {
    auth.setCurrentUser({
      id: 3,
      username: 'student',
      fullName: 'CampusCart Student',
      email: 'student@campuscart.com',
      pictureUrl: '',
      role: 'student',
      preferences: [],
    });

    component.logout();

    const request = http.expectOne('http://localhost:8000/api/logout');
    expect(request.request.method).toBe('POST');
    request.flush({ message: 'Logged out successfully.' });

    expect(auth.isLoggedIn()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
