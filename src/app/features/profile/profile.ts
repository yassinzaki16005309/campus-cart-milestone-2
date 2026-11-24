import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { apiErrorMessage } from '../../core/services/api-error';
import { Auth, ProfileChanges } from '../../core/services/auth';

/** The same choices as the signup form. */
export const PREFERENCE_OPTIONS = ['Textbooks', 'Lab Coats', 'University Merchandise'];

@Component({
  selector: 'app-profile',
  imports: [FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile {
  readonly preferenceOptions = PREFERENCE_OPTIONS;

  editing = signal(false);
  saving = signal(false);
  confirmingDelete = signal(false);
  deleting = signal(false);

  successMessage = signal('');
  errorMessage = signal('');

  // Edit form (plain fields, like the signup form)
  fullName = '';
  email = '';
  pictureUrl = '';
  creditCard = '';
  preferences: string[] = [];

  private router = inject(Router);

  constructor(public auth: Auth) {
    // A message left for this page (for example the signup confirmation) is shown once.
    const notice = auth.notice();

    if (notice) {
      if (auth.noticeKind() === 'error') {
        this.errorMessage.set(notice);
      } else {
        this.successMessage.set(notice);
      }

      auth.clearNotice();
    }
  }

  // EDIT
  startEditing(): void {
    const user = this.auth.currentUser();

    if (!user) {
      return;
    }

    this.fullName = user.fullName;
    this.email = user.email;
    this.pictureUrl = user.pictureUrl;
    this.creditCard = '';
    this.preferences = [...user.preferences];

    this.clearMessages();
    this.confirmingDelete.set(false);
    this.editing.set(true);
  }

  cancelEditing(): void {
    this.clearMessages();
    this.editing.set(false);
  }

  togglePreference(preference: string): void {
    this.preferences = this.preferences.includes(preference)
      ? this.preferences.filter((item) => item !== preference)
      : [...this.preferences, preference];
  }

  save(): void {
    this.clearMessages();

    if (!this.fullName.trim()) {
      this.errorMessage.set('Full name is required.');
      return;
    }

    if (!this.email.trim()) {
      this.errorMessage.set('Email is required.');
      return;
    }

    // Only the last 4 digits of a card ever leave the browser. A blank field keeps the
    // card that is already saved.
    const cardDigits = this.creditCard.replace(/\D/g, '');

    if (this.creditCard.trim() && cardDigits.length < 4) {
      this.errorMessage.set(
        'Enter at least 4 digits for the card, or leave the field blank to keep the current one.',
      );
      return;
    }

    const changes: ProfileChanges = {
      fullName: this.fullName.trim(),
      email: this.email.trim(),
      pictureUrl: this.pictureUrl.trim() || null,
      preferences: this.preferences,
    };

    if (cardDigits) {
      changes.creditCard = cardDigits.slice(-4);
    }

    this.saving.set(true);

    this.auth.updateProfile(changes).subscribe({
      next: (message) => {
        this.saving.set(false);
        this.editing.set(false);
        this.successMessage.set(message);
      },
      error: (error) => {
        this.saving.set(false);
        this.errorMessage.set(apiErrorMessage(error));
      },
    });
  }

  // DELETE (asks first; the server refuses while there are unpaid invoices)
  askDelete(): void {
    this.clearMessages();
    this.confirmingDelete.set(true);
  }

  cancelDelete(): void {
    this.confirmingDelete.set(false);
  }

  confirmDelete(): void {
    this.deleting.set(true);

    this.auth.deleteProfile().subscribe({
      next: () => {
        // Auth has logged the user out and left "Your account has been deleted." for Home.
        this.router.navigate(['/']);
      },
      error: (error) => {
        this.deleting.set(false);
        this.confirmingDelete.set(false);
        this.errorMessage.set(apiErrorMessage(error));
      },
    });
  }

  private clearMessages(): void {
    this.successMessage.set('');
    this.errorMessage.set('');
  }
}
