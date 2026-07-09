import { Component, inject, OnInit, signal, ViewEncapsulation } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonList,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { NeonBadgeComponent } from '../../ui';

function passwordMatchValidator(control: AbstractControl) {
  const password = control.get('password')?.value;
  const confirm = control.get('confirmPassword')?.value;
  if (!password || !confirm) return null;
  return password === confirm ? null : { passwordMismatch: true };
}

@Component({
  standalone: true,
  selector: 'app-register-page',
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
        <ion-title>{{ step() === 'signup' ? 'Crear cuenta' : 'Verificar email' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="auth-page ion-padding">
      <div class="auth-shell">
        <section class="u-surface-card u-p-5">
          @if (step() === 'signup') {
            <sg-neon-badge tone="purple">JOIN</sg-neon-badge>
            <h1 class="u-font-display u-text-xl u-fw-black u-mt-3 u-mb-2">Crear cuenta</h1>
            <p class="u-text-secondary u-text-sm u-mb-4">
              Registrate con tu email. Te enviamos un código de verificación.
            </p>

            <form [formGroup]="signupForm" (ngSubmit)="submitSignup()">
              <ion-list class="auth-form-list" lines="none">
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
                    autocomplete="new-password"
                  />
                </ion-item>
                <ion-item>
                  <ion-input
                    label="Confirmar contraseña"
                    labelPlacement="stacked"
                    type="password"
                    formControlName="confirmPassword"
                    autocomplete="new-password"
                  />
                </ion-item>
              </ion-list>

              <p class="u-hint u-mb-2">Mínimo 12 caracteres, mayúsculas, números y símbolos.</p>

              @if (signupForm.hasError('passwordMismatch') && signupForm.touched) {
                <p class="auth-notice auth-notice--error">Las contraseñas no coinciden.</p>
              }

              @if (error()) {
                <p class="auth-notice auth-notice--error">{{ error() }}</p>
              }

              @if (notice()) {
                <p class="auth-notice auth-notice--success">{{ notice() }}</p>
              }

              <div class="auth-actions">
                <button
                  type="submit"
                  class="u-btn u-btn--ai u-btn--block"
                  [disabled]="signupForm.invalid || loading()"
                >
                  {{ loading() ? 'Creando...' : 'Registrarme' }}
                </button>
                <a routerLink="/login" class="auth-link">Ya tengo cuenta</a>
              </div>
            </form>
          } @else {
            <sg-neon-badge tone="lime">VERIFY</sg-neon-badge>
            <h1 class="u-font-display u-text-xl u-fw-black u-mt-3 u-mb-2">Verificar email</h1>
            <p class="u-text-secondary u-text-sm u-mb-2">
              Enviamos un código a
            </p>
            <p class="u-font-mono u-text-sm u-text-lime u-mb-4 u-truncate">{{ registeredEmail() }}</p>
            <p class="u-hint u-mb-4">Revisá spam si no lo ves. El código vence en unos minutos.</p>

            <form [formGroup]="confirmForm" (ngSubmit)="submitConfirm()">
              <ion-list class="auth-form-list" lines="none">
                <ion-item>
                  <ion-input
                    class="auth-code-input"
                    label="Código de 6 dígitos"
                    labelPlacement="stacked"
                    formControlName="code"
                    inputmode="numeric"
                    maxlength="6"
                    autocomplete="one-time-code"
                  />
                </ion-item>
              </ion-list>

              @if (error()) {
                <p class="auth-notice auth-notice--error">{{ error() }}</p>
              }

              @if (notice()) {
                <p class="auth-notice auth-notice--success">{{ notice() }}</p>
              }

              <div class="auth-actions">
                <button
                  type="submit"
                  class="u-btn u-btn--lime u-btn--block"
                  [disabled]="confirmForm.invalid || loading()"
                >
                  {{ loading() ? 'Verificando...' : 'Confirmar y continuar' }}
                </button>
                <button
                  type="button"
                  class="auth-link"
                  [disabled]="loading()"
                  (click)="resendCode()"
                >
                  Reenviar código
                </button>
                <a routerLink="/login" class="auth-link">Volver al login</a>
              </div>
            </form>
          }
        </section>
      </div>
    </ion-content>
  `,
})
export class RegisterPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  readonly step = signal<'signup' | 'confirm'>('signup');
  readonly registeredEmail = signal('');
  private pendingPassword = '';

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  readonly signupForm = this.fb.nonNullable.group(
    {
      email: ['', [Validators.required, Validators.email]],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(12),
          Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/),
        ],
      ],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordMatchValidator },
  );

  readonly confirmForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
  });

  ngOnInit(): void {
    const step = this.route.snapshot.queryParamMap.get('step');
    const email = this.route.snapshot.queryParamMap.get('email');
    const state = history.state as { password?: string };

    if (step === 'confirm' && email) {
      this.registeredEmail.set(email);
      if (state.password) {
        this.pendingPassword = state.password;
      }
      this.step.set('confirm');
    }
  }

  async resendCode(): Promise<void> {
    const email = this.registeredEmail();
    if (!email) return;

    this.loading.set(true);
    this.error.set(null);
    this.notice.set(null);

    try {
      await this.auth.resendConfirmationCode(email);
      this.notice.set('Código reenviado. Revisá tu email (y spam).');
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'No se pudo reenviar el código');
    } finally {
      this.loading.set(false);
    }
  }

  async submitSignup(): Promise<void> {
    if (this.signupForm.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    try {
      const { email, password } = this.signupForm.getRawValue();
      await this.auth.register(email, password);
      this.pendingPassword = password;
      this.registeredEmail.set(email);
      this.step.set('confirm');
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'No se pudo crear la cuenta');
    } finally {
      this.loading.set(false);
    }
  }

  async submitConfirm(): Promise<void> {
    if (this.confirmForm.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    try {
      const email = this.registeredEmail();
      const { code } = this.confirmForm.getRawValue();
      await this.auth.confirmRegistration(email, code);

      if (!this.pendingPassword) {
        this.error.set('Confirmado. Volvé a login e ingresá con tu contraseña.');
        await this.router.navigate(['/login'], { queryParams: { email } });
        return;
      }

      await this.auth.login(email, this.pendingPassword);
      await this.auth.refreshUserAttributes();

      if (this.auth.needsOnboarding()) {
        await this.router.navigateByUrl('/onboarding');
        return;
      }

      await this.router.navigateByUrl('/tabs/dashboard');
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Código inválido');
    } finally {
      this.loading.set(false);
    }
  }
}
