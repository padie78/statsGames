import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { defaultHomeRouteForRole } from '../core/auth/user-role';

/** Redirige al home del portal según rol (player → dashboard, scout → talent). */
@Component({
  standalone: true,
  selector: 'app-role-home-redirect',
  template: '',
})
export class RoleHomeRedirectPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    void this.router.navigateByUrl(defaultHomeRouteForRole(this.auth.userRole()), {
      replaceUrl: true,
    });
  }
}
