import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';

import { Profile } from './profile';
import { Auth } from '../../core/services/auth';
import { User } from '../../core/models/user.model';

const API = 'http://localhost:8000/api/profile';

const STUDENT: User = {
  id: 3,
  username: 'student',
  fullName: 'CampusCart Student',
  email: 'student@campuscart.com',
  pictureUrl: '',
  role: 'student',
  preferences: ['Textbooks'],
  creditCardLast4: '1234',
};

describe('Profile', () => {
  let component: Profile;
  let fixture: ComponentFixture<Profile>;
  let auth: Auth;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Profile],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    auth = TestBed.inject(Auth);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    auth.setCurrentUser(STUDENT);

    fixture = TestBed.createComponent(Profile);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  const text = (): string => fixture.nativeElement.textContent as string;

  const buttonLabelled = (label: string): HTMLButtonElement | undefined =>
    (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find(
      (button) => button.textContent?.trim() === label,
    );

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // A message left for this page is shown once (for example the signup confirmation)
  it('should show a message left for the page once, then clear it', () => {
    auth.setNotice('Account created successfully. A confirmation email has been sent to a@b.test.');

    const fresh = TestBed.createComponent(Profile);
    fresh.detectChanges();

    expect(fresh.nativeElement.textContent).toContain(
      'Account created successfully. A confirmation email has been sent to a@b.test.',
    );
    expect(fresh.nativeElement.querySelector('.profile__message--success')).not.toBeNull();
    expect(auth.notice()).toBe('');
  });

  it('should show a refusal that was left for the page as an error', () => {
    auth.setNotice('Your student account does not have access to that page.', 'error');

    const fresh = TestBed.createComponent(Profile);
    fresh.detectChanges();

    expect(fresh.nativeElement.querySelector('.profile__message--error')).not.toBeNull();
    expect(fresh.nativeElement.querySelector('.profile__message--success')).toBeNull();
  });

  // RETRIEVE
  it('should show the details of the logged-in user', () => {
    expect(text()).toContain('CampusCart Student');
    expect(text()).toContain('student');
    expect(text()).toContain('student@campuscart.com');
    expect(text()).toContain('•••• 1234');
    expect(text()).toContain('Textbooks');
  });

  it('should offer to edit and to delete the account', () => {
    expect(buttonLabelled('Edit Profile')).toBeDefined();
    expect(buttonLabelled('Delete Account')).toBeDefined();
  });

  // UPDATE
  it('should open the edit form filled with the current values', () => {
    buttonLabelled('Edit Profile')!.click();
    fixture.detectChanges();

    expect(component.editing()).toBeTrue();
    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
    expect(component.fullName).toBe('CampusCart Student');
    expect(component.email).toBe('student@campuscart.com');
    expect(component.preferences).toEqual(['Textbooks']);
    expect(component.creditCard).toBe('');
  });

  it('should send only what is allowed and show the success message from the server', () => {
    component.startEditing();
    component.fullName = '  Renamed Student ';
    component.email = 'renamed@campuscart.com';
    component.pictureUrl = '';
    component.togglePreference('Lab Coats');

    component.save();

    const request = http.expectOne(API);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      fullName: 'Renamed Student',
      email: 'renamed@campuscart.com',
      pictureUrl: null,
      preferences: ['Textbooks', 'Lab Coats'],
    });
    request.flush({
      data: {
        ...STUDENT,
        fullName: 'Renamed Student',
        email: 'renamed@campuscart.com',
        preferences: ['Textbooks', 'Lab Coats'],
      },
      message: 'Profile updated successfully.',
    });
    fixture.detectChanges();

    expect(component.editing()).toBeFalse();
    expect(component.saving()).toBeFalse();
    expect(component.successMessage()).toBe('Profile updated successfully.');
    expect(auth.currentUser()?.fullName).toBe('Renamed Student');
    expect(text()).toContain('Profile updated successfully.');
    expect(text()).toContain('Renamed Student');
  });

  it('should never send the role or the username', () => {
    component.startEditing();

    component.save();

    const request = http.expectOne(API);
    const body = request.request.body as Record<string, unknown>;
    expect(Object.keys(body)).not.toContain('role');
    expect(Object.keys(body)).not.toContain('username');
    request.flush({ data: STUDENT, message: 'Profile updated successfully.' });
  });

  it('should send only the last 4 digits of a card that was typed', () => {
    component.startEditing();
    component.creditCard = '5555 4444 3333 9876';

    component.save();

    const request = http.expectOne(API);
    expect(request.request.body.creditCard).toBe('9876');
    expect(JSON.stringify(request.request.body)).not.toContain('5555');
    request.flush({
      data: { ...STUDENT, creditCardLast4: '9876' },
      message: 'Profile updated successfully.',
    });

    expect(auth.currentUser()?.creditCardLast4).toBe('9876');
  });

  it('should keep the saved card when the card field is left blank', () => {
    component.startEditing();

    component.save();

    const request = http.expectOne(API);
    expect(Object.keys(request.request.body)).not.toContain('creditCard');
    request.flush({ data: STUDENT, message: 'Profile updated successfully.' });
  });

  it('should refuse a card with fewer than 4 digits without calling the server', () => {
    component.startEditing();
    component.creditCard = '12';

    component.save();

    http.expectNone(API);
    expect(component.errorMessage()).toBe(
      'Enter at least 4 digits for the card, or leave the field blank to keep the current one.',
    );
    expect(component.editing()).toBeTrue();
  });

  it('should require a full name and an email before calling the server', () => {
    component.startEditing();
    component.fullName = '   ';

    component.save();
    expect(component.errorMessage()).toBe('Full name is required.');

    component.fullName = 'Someone';
    component.email = '';

    component.save();
    expect(component.errorMessage()).toBe('Email is required.');

    http.expectNone(API);
  });

  it('should show the server validation message and stay in the edit form', () => {
    component.startEditing();
    component.email = 'taken@campuscart.com';

    component.save();

    http
      .expectOne(API)
      .flush(
        { message: 'This email is already used by another account.' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    fixture.detectChanges();

    expect(component.errorMessage()).toBe('This email is already used by another account.');
    expect(component.editing()).toBeTrue();
    expect(component.saving()).toBeFalse();
    expect(auth.currentUser()).toEqual(STUDENT);
    expect(text()).toContain('This email is already used by another account.');
  });

  it('should leave the profile untouched when editing is cancelled', () => {
    component.startEditing();
    component.fullName = 'Changed but cancelled';

    component.cancelEditing();

    http.expectNone(API);
    expect(component.editing()).toBeFalse();
    expect(auth.currentUser()).toEqual(STUDENT);
  });

  it('should add and remove a preference', () => {
    component.startEditing();

    component.togglePreference('Lab Coats');
    expect(component.preferences).toEqual(['Textbooks', 'Lab Coats']);

    component.togglePreference('Textbooks');
    expect(component.preferences).toEqual(['Lab Coats']);
  });

  // DELETE
  it('should ask for confirmation before deleting and send nothing yet', () => {
    buttonLabelled('Delete Account')!.click();
    fixture.detectChanges();

    expect(component.confirmingDelete()).toBeTrue();
    expect(text()).toContain('Delete your account?');
    http.expectNone(API);

    buttonLabelled('Cancel')!.click();
    fixture.detectChanges();

    expect(component.confirmingDelete()).toBeFalse();
    http.expectNone(API);
    expect(auth.isLoggedIn()).toBeTrue();
  });

  it('should delete the account, log out and go to Home with the server message', () => {
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    component.askDelete();

    component.confirmDelete();

    const request = http.expectOne(API);
    expect(request.request.method).toBe('DELETE');
    request.flush({ message: 'Your account has been deleted.' });

    expect(auth.isLoggedIn()).toBeFalse();
    expect(auth.notice()).toBe('Your account has been deleted.');
    expect(navigate).toHaveBeenCalledOnceWith(['/']);
  });

  it('should show the server message and stay logged in when deletion is refused', () => {
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    component.askDelete();

    component.confirmDelete();

    http.expectOne(API).flush(
      {
        message: 'You still have unpaid invoices. Please pay them before deleting your account.',
        code: 'unpaid_invoices',
      },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();

    expect(component.errorMessage()).toBe(
      'You still have unpaid invoices. Please pay them before deleting your account.',
    );
    expect(component.confirmingDelete()).toBeFalse();
    expect(component.deleting()).toBeFalse();
    expect(auth.currentUser()).toEqual(STUDENT);
    expect(auth.notice()).toBe('');
    expect(navigate).not.toHaveBeenCalled();
    expect(text()).toContain('You still have unpaid invoices.');
  });
});
