import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Auth } from '../../core/services/auth';
import { Home } from './home';

describe('Home', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;
  let auth: Auth;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    auth = TestBed.inject(Auth);
    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show no notice by default', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.home__notice')).toBeNull();
  });

  // Leaves the notice exactly as the profile page does: through the real delete call.
  function leaveDeletedNotice(): void {
    const http = TestBed.inject(HttpTestingController);

    auth.deleteProfile().subscribe();
    http
      .expectOne('http://localhost:8000/api/profile')
      .flush({ message: 'Your account has been deleted.' });
  }

  it('should show the one-time notice left after the account was deleted', () => {
    leaveDeletedNotice();

    fixture.detectChanges();

    const notice = fixture.nativeElement.querySelector('.home__notice');
    expect(notice).not.toBeNull();
    expect(notice.textContent).toContain('Your account has been deleted.');
  });

  it('should clear the notice when the user leaves the page', () => {
    leaveDeletedNotice();
    fixture.detectChanges();
    expect(auth.notice()).toBe('Your account has been deleted.');

    fixture.destroy();

    expect(auth.notice()).toBe('');
  });
});
