import { Component, inject, OnInit, signal, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import { isAlreadyAuthenticatedError, mapAuthErrorMessage } from '../../core/auth/auth.errors';
import { AuthService } from '../../core/services/auth.service';

@Component({
  standalone: true,
  selector: 'app-auth-callback-page',
  encapsulation: ViewEncapsulation.None,
  imports: [IonContent, IonSpinner],
  template: `
    <ion-content class="auth-page ion-padding">
      <div class="auth-shell u-text-center u-py-4">
        @if (error()) {
          <p class="auth-notice auth-notice--error">{{ error() }}</p>
        } @else {
          <ion-spinner name="crescent" />
          <p class="u-text-secondary u-text-sm u-mt-3">Completando autenticación...</p>
        }
      </div>
    </ion-content>
  `,
})
export class AuthCallbackPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      await this.auth.completeOAuthRedirect();

      if (this.auth.needsOnboarding()) {
        await this.router.navigateByUrl('/onboarding');
        return;
      }

      await this.router.navigateByUrl('/tabs/dashboard');
    } catch (err) {
      if (isAlreadyAuthenticatedError(err)) {
        await this.auth.resumeExistingSession();
        if (this.auth.needsOnboarding()) {
          await this.router.navigateByUrl('/onboarding');
          return;
        }
        await this.router.navigateByUrl('/tabs/dashboard');
        return;
      }
      this.error.set(mapAuthErrorMessage(err));
      setTimeout(() => void this.router.navigateByUrl('/login'), 2500);
    }
  }
}
