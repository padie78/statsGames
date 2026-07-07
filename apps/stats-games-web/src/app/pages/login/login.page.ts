import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonInput,
  IonItem,
  IonList,
  IonText,
  IonTitle,
  IonToolbar,
  IonHeader,
} from '@ionic/angular/standalone';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-login-page',
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
        <ion-title>StatsGames</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <form [formGroup]="form" (ngSubmit)="submit()">
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
              autocomplete="current-password"
            />
          </ion-item>
        </ion-list>

        @if (error()) {
          <ion-text color="danger"><p>{{ error() }}</p></ion-text>
        }

        <ion-button expand="block" type="submit" [disabled]="form.invalid || loading()">
          {{ loading() ? 'Ingresando...' : 'Ingresar' }}
        </ion-button>

        <ion-button expand="block" fill="clear" routerLink="/register">
          Crear cuenta
        </ion-button>
      </form>
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
      this.error.set(err instanceof Error ? err.message : 'Error de autenticación');
    } finally {
      this.loading.set(false);
    }
  }
}
