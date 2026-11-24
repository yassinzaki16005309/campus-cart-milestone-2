import { Component, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth } from '../../core/services/auth';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnDestroy {
  constructor(public auth: Auth) {}

  // A one-time notice (for example after the account was deleted) is shown once,
  // then cleared when the user leaves the page.
  ngOnDestroy(): void {
    this.auth.clearNotice();
  }
}
