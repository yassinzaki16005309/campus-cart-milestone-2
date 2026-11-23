import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../../core/services/auth';
import { apiErrorMessage } from '../../../core/services/api-error';

@Component({
  selector: 'app-signup',
  imports: [FormsModule, RouterLink],
  templateUrl: './signup.html',
  styleUrl: './signup.css',
})
export class Signup {
  username = '';
  fullName = '';
  email = '';
  pictureUrl = '';
  password = '';
  creditCard = '';
  preferences: string[] = [];

  errorMessage = '';

  private changeDetector = inject(ChangeDetectorRef);

  constructor(
    private auth: Auth,
    private router: Router,
  ) {}

  togglePreference(preference: string): void {
    if (this.preferences.includes(preference)) {
      this.preferences = this.preferences.filter((item) => item !== preference);
    } else {
      this.preferences.push(preference);
    }
  }

  signup(): void {
    // Only the last 4 digits ever leave the browser (as in Milestone 1, where
    // only the last 4 digits were kept).
    const cardDigits = this.creditCard.replace(/\D/g, '');

    this.errorMessage = '';

    this.auth
      .register(
        {
          username: this.username,
          fullName: this.fullName,
          email: this.email,
          pictureUrl: this.pictureUrl,
          role: 'student',
          preferences: this.preferences,
          creditCardLast4: cardDigits.length >= 4 ? cardDigits.slice(-4) : undefined,
        },
        this.password,
      )
      .subscribe({
        next: () => {
          this.router.navigate(['/profile']);
        },
        error: (error) => {
          this.errorMessage = apiErrorMessage(
            error,
            'Username or email already exists, or password is invalid.',
          );
          this.changeDetector.markForCheck();
        },
      });
  }
}
