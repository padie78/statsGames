import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { MatchService, type MatchUpdateView } from '../../services/match.service';
import { PlayerService, type PlayerProfileView } from '../../services/player.service';
import { MatchLiveStore } from '../../stores/match-live.store';

@Component({
  standalone: true,
  selector: 'app-dashboard-page',
  imports: [
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonList,
    IonItem,
    IonLabel,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonBadge,
    IonButton,
    IonText,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Dashboard</ion-title>
        <ion-button slot="end" fill="clear" color="light" (click)="logout()">Salir</ion-button>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      @if (error()) {
        <ion-text color="danger"><p>{{ error() }}</p></ion-text>
      }

      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ profile()?.gamerTag ?? 'Gamer' }}</ion-card-title>
          <ion-card-subtitle>{{ profile()?.primaryPlatform ?? '—' }}</ion-card-subtitle>
        </ion-card-header>
        <ion-card-content>
          <p>Email: {{ auth.email() ?? '—' }}</p>
          @if (profile()?.fortniteId) {
            <p>Fortnite: {{ profile()?.fortniteId }}</p>
          }
          @if (profile()?.robloxId) {
            <p>Roblox: {{ profile()?.robloxId }}</p>
          }
        </ion-card-content>
      </ion-card>

      @if (showLinkPlatformForm()) {
        <ion-card>
          <ion-card-header>
            <ion-card-title>Vincular cuenta de juego</ion-card-title>
            <ion-card-subtitle>Para webhooks con platformUserId</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <form [formGroup]="linkForm" (ngSubmit)="submitLinkPlatform()">
              <ion-list lines="full">
                <ion-item>
                  <ion-select label="Plataforma" labelPlacement="stacked" formControlName="platform">
                    @if (!profile()?.fortniteId) {
                      <ion-select-option value="fortnite">Fortnite</ion-select-option>
                    }
                    @if (!profile()?.robloxId) {
                      <ion-select-option value="roblox">Roblox</ion-select-option>
                    }
                  </ion-select>
                </ion-item>
                <ion-item>
                  <ion-input
                    label="ID externo"
                    labelPlacement="stacked"
                    formControlName="externalId"
                  />
                </ion-item>
              </ion-list>

              @if (linkError()) {
                <ion-text color="danger"><p>{{ linkError() }}</p></ion-text>
              }

              <ion-button expand="block" type="submit" [disabled]="linkForm.invalid || linking()">
                {{ linking() ? 'Vinculando...' : 'Vincular' }}
              </ion-button>
            </form>
          </ion-card-content>
        </ion-card>
      }

      <ion-card>
        <ion-card-header>
          <ion-card-title>Partidas recientes</ion-card-title>
          <ion-card-subtitle>{{ matches().length }} cargadas</ion-card-subtitle>
        </ion-card-header>
        <ion-card-content>
          <ion-list>
            @for (match of matches(); track match.matchId) {
              <ion-item>
                <ion-label>
                  <h2>{{ match.platform }} · {{ match.matchId }}</h2>
                  <p>{{ match.summary }}</p>
                  <p>{{ match.updatedAt }}</p>
                </ion-label>
              </ion-item>
            } @empty {
              <ion-item>
                <ion-label>Sin partidas todavía.</ion-label>
              </ion-item>
            }
          </ion-list>
        </ion-card-content>
      </ion-card>

      <ion-card>
        <ion-card-header>
          <ion-card-title>Live feed</ion-card-title>
          <ion-card-subtitle>Subscription onMatchUpdate</ion-card-subtitle>
        </ion-card-header>
        <ion-card-content>
          <ion-list>
            @for (update of liveStore.liveUpdates(); track update.matchId + update.updatedAt) {
              <ion-item>
                <ion-badge slot="start" color="success">LIVE</ion-badge>
                <ion-label>
                  <h2>{{ update.platform }} · {{ update.matchId }}</h2>
                  <p>{{ update.summary }}</p>
                </ion-label>
              </ion-item>
            } @empty {
              <ion-item>
                <ion-label>Esperando eventos en tiempo real...</ion-label>
              </ion-item>
            }
          </ion-list>
        </ion-card-content>
      </ion-card>
    </ion-content>
  `,
})
export class DashboardPageComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly matchService = inject(MatchService);
  private readonly playerService = inject(PlayerService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  readonly liveStore = inject(MatchLiveStore);

  readonly profile = signal<PlayerProfileView | null>(null);
  readonly matches = signal<MatchUpdateView[]>([]);
  readonly error = signal<string | null>(null);
  readonly linking = signal(false);
  readonly linkError = signal<string | null>(null);

  readonly showLinkPlatformForm = computed(() => {
    const p = this.profile();
    if (!p) return false;
    return !p.fortniteId || !p.robloxId;
  });

  readonly linkForm = this.fb.nonNullable.group({
    platform: ['roblox' as 'fortnite' | 'roblox', Validators.required],
    externalId: ['', [Validators.required, Validators.minLength(1)]],
  });

  ngOnInit(): void {
    void this.loadData();
    this.liveStore.ensureStarted();
  }

  async refresh(event: CustomEvent): Promise<void> {
    await this.loadData();
    (event.target as HTMLIonRefresherElement).complete();
  }

  async logout(): Promise<void> {
    this.liveStore.reset();
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }

  async submitLinkPlatform(): Promise<void> {
    if (this.linkForm.invalid) return;

    const userId = this.auth.userId();
    if (!userId) return;

    this.linking.set(true);
    this.linkError.set(null);

    try {
      const { platform, externalId } = this.linkForm.getRawValue();
      const updated = await firstValueFrom(
        this.playerService.linkPlatformAccount({
          userId,
          platform,
          externalId: externalId.trim(),
        }),
      );
      this.profile.set(updated);
      this.linkForm.reset({
        platform: updated.fortniteId ? 'roblox' : 'fortnite',
        externalId: '',
      });
    } catch (err) {
      this.linkError.set(err instanceof Error ? err.message : 'No se pudo vincular la cuenta');
    } finally {
      this.linking.set(false);
    }
  }

  private async loadData(): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) return;

    this.error.set(null);
    try {
      const profile = await this.playerService.getPlayerProfileOrNull(userId);
      if (!profile) {
        await this.router.navigateByUrl('/onboarding');
        return;
      }
      this.profile.set(profile);
      this.linkForm.patchValue({
        platform: profile.fortniteId ? 'roblox' : 'fortnite',
      });

      this.matchService.listPlayerMatches(userId).subscribe({
        next: (rows) => this.matches.set(rows),
        error: (err) =>
          this.error.set(err instanceof Error ? err.message : 'Error cargando partidas'),
      });
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Error inesperado');
    }
  }
}
