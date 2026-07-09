import { Component, inject, signal, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { AuthService, type SelectedGame } from '../../core/services/auth.service';
import { PlayerService } from '../../services/player.service';
import { GameSelectionCardComponent, NeonBadgeComponent } from '../../ui';

@Component({
  standalone: true,
  selector: 'app-onboarding-page',
  encapsulation: ViewEncapsulation.None,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    NeonBadgeComponent,
    GameSelectionCardComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Onboarding</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="auth-page ion-padding">
      <div class="auth-shell auth-shell--wide">
        <section class="u-surface-card u-p-5">
          <sg-neon-badge tone="purple">TELEMETRY</sg-neon-badge>
          <h1 class="u-font-display u-text-2xl u-fw-black u-mt-3 u-mb-2">ELEGÍ TU ARENA</h1>
          <p class="u-text-secondary u-text-sm u-mb-4">
            Seleccioná el juego principal para calibrar tu feed en vivo y métricas de rendimiento.
          </p>

          <div class="sg-game-picker u-mb-4">
            <sg-game-selection-card
              game="roblox"
              badge="Sandbox MMO"
              title="Roblox"
              subtitle="Creatividad infinita, sesiones largas y economía de experiencias."
              stats="K/D · Sessions · XP/h"
              [selected]="selectedGame() === 'roblox'"
              (select)="pickGame($event)"
            />
            <sg-game-selection-card
              game="fortnite"
              badge="Battle Royale"
              title="Fortnite"
              subtitle="Alta competencia, placement agresivo y clutch moments."
              stats="Placement · Eliminations · Win Rate"
              [selected]="selectedGame() === 'fortnite'"
              (select)="pickGame($event)"
            />
          </div>

          @if (error()) {
            <p class="auth-notice auth-notice--error">{{ error() }}</p>
          }

          <div class="auth-actions">
            <button
              type="button"
              class="u-btn u-btn--lime u-btn--block"
              [disabled]="!selectedGame() || loading()"
              (click)="confirm()"
            >
              {{ loading() ? 'Sincronizando...' : 'INGRESAR AL CENTRO DE CONTROL ⚡' }}
            </button>
          </div>
        </section>
      </div>
    </ion-content>
  `,
})
export class OnboardingPageComponent {
  private readonly auth = inject(AuthService);
  private readonly player = inject(PlayerService);
  private readonly router = inject(Router);

  readonly selectedGame = signal<SelectedGame | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  pickGame(game: SelectedGame): void {
    this.selectedGame.set(game);
    this.error.set(null);
  }

  async confirm(): Promise<void> {
    const game = this.selectedGame();
    const userId = this.auth.userId();
    if (!game || !userId) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      await this.auth.updateSelectedGame(game);

      const emailPrefix = (this.auth.email() ?? 'player').split('@')[0] ?? 'player';
      const gamerTag = emailPrefix.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'Player';

      await firstValueFrom(
        this.player.upsertPlayerProfile({
          userId,
          gamerTag,
          primaryPlatform: game,
        }),
      );

      await this.router.navigateByUrl('/tabs/dashboard');
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'No se pudo guardar tu selección');
    } finally {
      this.loading.set(false);
    }
  }
}
