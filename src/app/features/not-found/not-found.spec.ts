import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from '../../app.routes';
import { Auth } from '../../core/services/auth';
import { User } from '../../core/models/user.model';
import { NotFound } from './not-found';

const STUDENT: User = {
  id: 3,
  username: 'student',
  fullName: 'CampusCart Student',
  email: 'student@campuscart.com',
  pictureUrl: '',
  role: 'student',
  preferences: [],
};

describe('NotFound', () => {
  let auth: Auth;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotFound],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(routes)],
    }).compileComponents();

    auth = TestBed.inject(Auth);
  });

  const linkTexts = (element: HTMLElement): string[] =>
    Array.from(element.querySelectorAll('a')).map((link) => link.textContent!.trim());

  it('should create', () => {
    const fixture = TestBed.createComponent(NotFound);

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should tell the user the page was not found and offer a way back home', () => {
    const fixture = TestBed.createComponent(NotFound);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.textContent).toContain('404');
    expect(element.querySelector('h1')?.textContent).toContain('Page not found');
    expect(element.querySelector('[role="alert"]')).not.toBeNull();
    expect(linkTexts(element)).toContain('Back to Home');
  });

  it('should offer Login to a visitor who is not logged in', () => {
    const fixture = TestBed.createComponent(NotFound);
    fixture.detectChanges();

    expect(linkTexts(fixture.nativeElement)).toEqual(['Back to Home', 'Login']);
  });

  it('should offer the profile to a logged-in user', () => {
    auth.setCurrentUser(STUDENT);
    const fixture = TestBed.createComponent(NotFound);
    fixture.detectChanges();

    expect(linkTexts(fixture.nativeElement)).toEqual(['Back to Home', 'My Profile']);
  });

  // The real route table: an unknown URL must show the page, not redirect silently.
  it('should be shown for an unknown URL, which stays in the address bar', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/this-page-does-not-exist');

    expect(TestBed.inject(Router).url).toBe('/this-page-does-not-exist');
    expect(harness.routeNativeElement?.textContent).toContain('Page not found');
  });

  it('should be shown for an unknown nested URL', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/store/does/not/exist');

    expect(harness.routeNativeElement?.textContent).toContain('Page not found');
  });

  it('should not replace the Home page', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/');

    expect(harness.routeNativeElement?.textContent).not.toContain('Page not found');
    expect(harness.routeNativeElement?.textContent).toContain('CampusCart');
  });
});
