import { Component, inject, OnInit, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonList,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { AuthService } from '../../core/auth/auth.service';

function passwordMatchValidator(control: AbstractControl) {
  const password = control.get('password')?.value;
  const confirm = control.get('confirmPassword')?.value;
  if (!password || !confirm) return null;
  return password === confirm ? null : { passwordMismatch: true };
}

@Component({
  standalone: true,
  selector: 'app-register-page',
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
    IonText,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>{{ step() === 'signup' ? 'Crear cuenta' : 'Verificar email' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (step() === 'signup') {
        <form [formGroup]="signupForm" (ngSubmit)="submitSignup()">
          <ion-list lines="full">
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

          <ion-text color="medium">
            <p class="u-hint">Mínimo 12 caracteres, mayúsculas, números y símbolos.</p>
          </ion-text>

          @if (signupForm.hasError('passwordMismatch') && signupForm.touched) {
            <ion-text color="danger"><p>Las contraseñas no coinciden.</p></ion-text>
          }

          @if (error()) {
            <ion-text color="danger"><p>{{ error() }}</p></ion-text>
          }

          @if (notice()) {
            <ion-text color="success"><p>{{ notice() }}</p></ion-text>
          }

          <ion-button expand="block" type="submit" [disabled]="signupForm.invalid || loading()">
            {{ loading() ? 'Creando...' : 'Registrarme' }}
          </ion-button>
        </form>
      } @else {
        <form [formGroup]="confirmForm" (ngSubmit)="submitConfirm()">
          <ion-text color="medium">
            <p>Enviamos un código a <strong>{{ registeredEmail() }}</strong></p>
            <p class="u-hint">Revisá spam si no lo ves. El código vence en unos minutos.</p>
          </ion-text>

          <ion-list lines="full">
            <ion-item>
              <ion-input
                label="Código de verificación"
                labelPlacement="stacked"
                formControlName="code"
                inputmode="numeric"
              />
            </ion-item>
          </ion-list>

          @if (error()) {
            <ion-text color="danger"><p>{{ error() }}</p></ion-text>
          }

          @if (notice()) {
            <ion-text color="success"><p>{{ notice() }}</p></ion-text>
          }

          <ion-button expand="block" type="submit" [disabled]="confirmForm.invalid || loading()">
            {{ loading() ? 'Verificando...' : 'Confirmar y continuar' }}
          </ion-button>

          <ion-button
            expand="block"
            fill="clear"
            type="button"
            [disabled]="loading()"
            (click)="resendCode()"
          >
            Reenviar código
          </ion-button>
        </form>
      }

      <ion-button expand="block" fill="clear" routerLink="/login">
        Ya tengo cuenta
      </ion-button>
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
    code: ['', [Validators.required, Validators.minLength(6)]],
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

      if (this.pendingPassword) {
        await this.auth.login(email, this.pendingPassword);
      } else {
        this.error.set('Confirmado. Volvé a login e ingresá con tu contraseña.');
        await this.router.navigate(['/login'], { queryParams: { email } });
        return;
      }

      await this.router.navigateByUrl('/onboarding');
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Código inválido');
    } finally {
      this.loading.set(false);
    }
  }
}
