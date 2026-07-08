import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonList,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { PlayerService } from '../../services/player.service';

@Component({
  standalone: true,
  selector: 'app-onboarding-page',
  imports: [
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonText,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Configurá tu perfil</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-text color="medium">
        <p>Completá tu gamer tag y plataforma principal para empezar a trackear partidas.</p>
      </ion-text>

      <form [formGroup]="form" (ngSubmit)="submit()">
        <ion-list lines="full">
          <ion-item>
            <ion-input
              label="Gamer tag"
              labelPlacement="stacked"
              formControlName="gamerTag"
              maxlength="64"
            />
          </ion-item>

          <ion-item>
            <ion-select label="Plataforma principal" labelPlacement="stacked" formControlName="primaryPlatform">
              <ion-select-option value="fortnite">Fortnite</ion-select-option>
              <ion-select-option value="roblox">Roblox</ion-select-option>
            </ion-select>
          </ion-item>

          @if (form.controls.primaryPlatform.value === 'fortnite') {
            <ion-item>
              <ion-input
                label="Fortnite Account ID (opcional)"
                labelPlacement="stacked"
                formControlName="fortniteId"
              />
            </ion-item>
          }

          @if (form.controls.primaryPlatform.value === 'roblox') {
            <ion-item>
              <ion-input
                label="Roblox User ID (opcional)"
                labelPlacement="stacked"
                formControlName="robloxId"
              />
            </ion-item>
          }
        </ion-list>

        <ion-text color="medium">
          <p class="u-hint">
            El ID de plataforma permite recibir webhooks con platformUserId sin conocer tu Cognito sub.
          </p>
        </ion-text>

        @if (error()) {
          <ion-text color="danger"><p>{{ error() }}</p></ion-text>
        }

        <ion-button expand="block" type="submit" [disabled]="form.invalid || loading()">
          {{ loading() ? 'Guardando...' : 'Continuar al dashboard' }}
        </ion-button>
      </form>
    </ion-content>
  `,
})
export class OnboardingPageComponent {
  private readonly auth = inject(AuthService);
  private readonly player = inject(PlayerService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    gamerTag: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(64)]],
    primaryPlatform: ['roblox' as 'fortnite' | 'roblox', [Validators.required]],
    fortniteId: [''],
    robloxId: [''],
  });

  async submit(): Promise<void> {
    if (this.form.invalid) return;

    const userId = this.auth.userId();
    if (!userId) {
      await this.router.navigateByUrl('/login');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const raw = this.form.getRawValue();
      const input = {
        userId,
        gamerTag: raw.gamerTag.trim(),
        primaryPlatform: raw.primaryPlatform,
        ...(raw.primaryPlatform === 'fortnite' && raw.fortniteId.trim()
          ? { fortniteId: raw.fortniteId.trim() }
          : {}),
        ...(raw.primaryPlatform === 'roblox' && raw.robloxId.trim()
          ? { robloxId: raw.robloxId.trim() }
          : {}),
      };

      await firstValueFrom(this.player.upsertPlayerProfile(input));
      await this.router.navigateByUrl('/tabs/dashboard');
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'No se pudo guardar el perfil');
    } finally {
      this.loading.set(false);
    }
  }
}
