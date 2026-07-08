import { Component, inject, signal, ViewEncapsulation } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonList,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { AuthPendingConfirmationError, mapAuthErrorMessage } from '../../core/auth/auth.errors';
import { AuthService } from '../../core/auth/auth.service';
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
    IonButton,
    NeonBadgeComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>StatsGames</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="page-shell u-flex u-flex-col u-gap-4 u-py-4">
        <section class="u-surface-card u-p-5">
          <sg-neon-badge tone="lime">BETA</sg-neon-badge>
          <h1 class="u-font-display u-text-2xl u-fw-black u-mt-3 u-mb-2">Entrá a tu stats</h1>
          <p class="u-text-secondary u-text-sm u-mb-4">
            ¿Primera vez? Creá tu cuenta gratis abajo. Después confirmás el email y configurás tu gamer tag.
          </p>

          <form [formGroup]="form" (ngSubmit)="submit()">
            <ion-list lines="none">
              <ion-item>
                <ion-input
                  label="Email"
                  labelPlacement="stacked"
                  type="email"
                  formControlName="email"
                  autocomplete="email"
                />
              </ion-item>
              <ion-item>
                <ion-input
                  label="Contraseña"
                  labelPlacement="stacked"
                  type="password"
                  formControlName="password"
                  autocomplete="current-password"
                />
              </ion-item>
            </ion-list>

            <p class="u-hint">Mín. 12 caracteres, mayúscula, número y símbolo (ej: <strong>StatsGames1!</strong>)</p>

            @if (error()) {
              <p class="u-error">{{ error() }}</p>
            }

            <button
              type="submit"
              class="u-btn u-btn--lime u-btn--block u-mt-3"
              [disabled]="form.invalid || loading()"
            >
              {{ loading() ? 'Ingresando...' : 'Ingresar' }}
            </button>
          </form>
        </section>

        <section class="u-surface-card u-surface-card--ai u-p-5 u-text-center">
          <p class="u-font-display u-text-sm u-fw-bold u-uppercase u-tracking-wide u-text-purple u-mb-2">
            ¿No tenés cuenta?
          </p>
          <p class="u-text-secondary u-text-sm u-mb-4">
            Registrate con tu email. Te llega un código de verificación y en 1 minuto estás en el dashboard.
          </p>
          <a routerLink="/register" class="u-btn u-btn--ai u-btn--block">
            Crear cuenta gratis
          </a>
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

  async submit(): Promise<void> {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.login(email, password);
      await this.router.navigateByUrl('/tabs/dashboard');
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
}
