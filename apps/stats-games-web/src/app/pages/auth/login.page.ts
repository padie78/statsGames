import { Component, inject, signal, ViewEncapsulation } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonList,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { AuthPendingConfirmationError, mapAuthErrorMessage } from '../../core/auth/auth.errors';
import { AuthService, type SocialProvider } from '../../core/services/auth.service';
import { NeonBadgeComponent } from '../../ui';

@Component({
  standalone: true,
  selector: 'app-login-page',
  encapsulation: ViewEncapsulation.None,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonInput,
    NeonBadgeComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>StatsGames</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="auth-page ion-padding">
      <div class="auth-shell u-flex u-flex-col u-gap-4">
        <section class="u-surface-card u-p-5">
          <sg-neon-badge tone="lime">BETA</sg-neon-badge>
          <h1 class="u-font-display u-text-2xl u-fw-black u-mt-3 u-mb-2">DOMINA TUS STATS</h1>
          <p class="u-text-secondary u-text-sm u-mb-4">
            Telemetría en tiempo real para Roblox y Fortnite. Entrá con tu cuenta o email.
          </p>

          <div class="auth-social-grid u-mb-2">
            <button type="button" class="u-btn u-btn--block u-btn--social u-btn--google" [disabled]="loading()" (click)="social('Google')">
              <span class="u-btn__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M21.6 12.227c0-.709-.064-1.39-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.996 3.018v2.507h3.226c1.891-1.742 2.988-4.305 2.988-7.348z"/><path d="M12 22c2.7 0 4.964-.894 6.618-2.423l-3.226-2.507c-.894.6-2.036.955-3.392.955-2.605 0-4.81-1.76-5.595-4.123H3.064v2.59A9.996 9.996 0 0 0 12 22z"/><path d="M6.405 14.902A5.99 5.99 0 0 1 6 12c0-1.01.245-1.964.682-2.802V6.608H3.064A9.996 9.996 0 0 0 2 12c0 1.935.522 3.753 1.436 5.314l3.969-2.412z"/><path d="M12 5.386c1.47 0 2.787.505 3.823 1.496l2.868-2.868C16.955 2.99 14.7 2 12 2 7.7 2 3.978 4.168 2.064 7.392l3.969 2.412C7.19 7.386 9.395 5.386 12 5.386z"/></svg>
              </span>
              Continuar con Google
            </button>

            <button type="button" class="u-btn u-btn--block u-btn--social u-btn--apple" [disabled]="loading()" (click)="social('Apple')">
              <span class="u-btn__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M16.365 1.43c0 1.14-.46 2.2-1.24 2.99-.84.84-2.05 1.32-3.24 1.24-.08-1.1.42-2.24 1.18-3.02.86-.88 2.1-1.38 3.3-1.21zm3.2 17.07c-.56 1.28-.82 1.86-1.54 3-.99 1.62-2.39 3.64-4.12 3.66-1.54.02-1.94-.99-4.03-.97-2.1.02-2.56 1-4.1.98-1.74-.03-3.07-1.77-4.06-3.38-2.78-4.55-3.08-9.88-1.36-12.72 1.22-1.98 3.16-3.14 5.01-3.14 1.87 0 3.04 1 4.58 1 1.5 0 2.42-1 4.52-1 1.8 0 3.7.98 4.92 2.67-4.32 2.35-3.62 8.46.76 10.04-.3.8-.64 1.55-1.08 2.38z"/></svg>
              </span>
              Continuar con Apple
            </button>

            <button type="button" class="u-btn u-btn--block u-btn--social u-btn--discord" [disabled]="loading()" (click)="social('Discord')">
              <span class="u-btn__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037 12.3 12.3 0 0 0-.608 1.25 18.3 18.3 0 0 0-5.487 0 11.6 11.6 0 0 0-.617-1.25.08.08 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.08.08 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.08.08 0 0 0 .084-.028 14.1 14.1 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13 13 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.07.07 0 0 1 .073-.01c3.927 1.793 8.18 1.793 12.062 0a.07.07 0 0 1 .074.01c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107 15.2 15.2 0 0 0 1.225 1.993.08.08 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.08.08 0 0 0 .032-.054c.5-5.177-.838-9.66-3.549-13.66a.06.06 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
              </span>
              Continuar con Discord
            </button>
          </div>

          <div class="auth-divider">o con email</div>

          <form [formGroup]="form" (ngSubmit)="submit()">
            <ion-list class="auth-form-list" lines="none">
              <ion-item>
                <ion-input label="Email" labelPlacement="stacked" type="email" formControlName="email" autocomplete="email" />
              </ion-item>
              <ion-item>
                <ion-input label="Contraseña" labelPlacement="stacked" type="password" formControlName="password" autocomplete="current-password" />
              </ion-item>
            </ion-list>

            <p class="u-hint u-mb-2">Mín. 12 caracteres, mayúscula, número y símbolo.</p>

            @if (error()) {
              <p class="auth-notice auth-notice--error">{{ error() }}</p>
            }

            <div class="auth-actions">
              <button type="submit" class="u-btn u-btn--lime u-btn--block" [disabled]="form.invalid || loading()">
                {{ loading() ? 'Ingresando...' : 'Ingresar' }}
              </button>
              <a routerLink="/register" class="auth-link">Crear cuenta con email</a>
            </div>
          </form>
        </section>
      </div>
    </ion-content>
  `,
})
export class LoginPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(12)]],
  });

  async social(provider: SocialProvider): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.loginWithSocialProvider(provider);
    } catch (err) {
      this.error.set(mapAuthErrorMessage(err));
      this.loading.set(false);
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.login(email, password);
      await this.navigateAfterAuth();
    } catch (err) {
      if (err instanceof AuthPendingConfirmationError) {
        await this.router.navigate(['/register'], {
          queryParams: { step: 'confirm', email: err.email },
          state: { password: err.password },
        });
        return;
      }
      this.error.set(mapAuthErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  private async navigateAfterAuth(): Promise<void> {
    if (this.auth.needsOnboarding()) {
      await this.router.navigateByUrl('/onboarding');
      return;
    }
    await this.router.navigateByUrl('/tabs/dashboard');
  }
}
