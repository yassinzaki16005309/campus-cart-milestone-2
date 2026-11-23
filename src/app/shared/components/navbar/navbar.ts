import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../../core/services/auth';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  constructor(
    public auth: Auth,
    private router: Router,
  ) {}

  logout(): void {
    // The session is ended on the server, then the user is sent to the login page.
    this.auth.logout().subscribe(() => {
      this.router.navigate(['/login']);
    });
  }
}
