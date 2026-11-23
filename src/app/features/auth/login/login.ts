import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../../core/services/auth';
import { Storage } from '../../../core/services/storage';
import { apiErrorMessage } from '../../../core/services/api-error';

// Cookie that remembers the last username (small, non-sensitive, survives
// browser restarts). Since Milestone 2 the SERVER creates and clears it: the
// login request carries the "Remember me" choice and Laravel answers with Set-Cookie.
// The form only reads it to pre-fill the username.
export const REMEMBER_COOKIE = 'campusCartRememberedUsername';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  username = '';
  password = '';
  rememberMe = false;
  errorMessage = '';

  private changeDetector = inject(ChangeDetectorRef);

  constructor(
    private auth: Auth,
    private router: Router,
    private storage: Storage,
  ) {
    // Pre-fill the username if the user chose "Remember me" before
    const remembered = this.storage.getCookie(REMEMBER_COOKIE);

    if (remembered) {
      this.username = remembered;
      this.rememberMe = true;
    }
  }

  login(): void {
    this.errorMessage = '';

    this.auth.login(this.username, this.password, this.rememberMe).subscribe({
      next: () => {
        this.router.navigate(['/profile']);
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(error, 'Invalid username or password.');
        this.changeDetector.markForCheck();
      },
    });
  }
}
