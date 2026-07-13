import { Component, inject, signal, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { AuthService, type SelectedGame, type UserRole } from '../../core/services/auth.service';
import { defaultHomeRouteForRole } from '../../core/auth/user-role';
import { GAME_PLATFORM_LIST } from '../../core/game/game-platform.config';
import { backendPlatformForGame } from '../../core/game/selected-game';
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
          <sg-neon-badge tone="purple">Alta de cuenta</sg-neon-badge>
          <h1 class="sg-page-header__title u-text-2xl u-mt-3 u-mb-2">Configurá tu portal</h1>
          <p class="sg-page-header__subtitle u-mb-4">
            Elegí tu rol al registrarte y el juego principal. El menú y los dashboards se adaptan a esa combinación.
          </p>

          <p class="sg-settings-section__label u-mb-2">1. ¿Cómo vas a usar StatsGames?</p>
          <div class="sg-settings-mode u-mb-5">
            <button
              type="button"
              class="sg-settings-mode__btn"
              [class.sg-settings-mode__btn--active]="selectedRole() === 'player'"
              (click)="pickRole('player')"
            >
              <span class="sg-settings-mode__title">Jugador</span>
              <span class="sg-settings-mode__desc">
                Mi rendimiento: historial, evolución táctica y perfil público
              </span>
            </button>
            <button
              type="button"
              class="sg-settings-mode__btn"
              [class.sg-settings-mode__btn--active]="selectedRole() === 'scout'"
              (click)="pickRole('scout')"
            >
              <span class="sg-settings-mode__title">Scout</span>
              <span class="sg-settings-mode__desc">
                Captación: buscador de talento, radar, reportes y equipo
              </span>
            </button>
          </div>

          <p class="sg-settings-section__label u-mb-2">2. Juego principal</p>
          <div class="sg-game-picker sg-game-picker--grid u-mb-4">
            @for (platform of platforms; track platform.id) {
              <sg-game-selection-card
                [game]="platform.id"
                [selected]="selectedGame() === platform.id"
                (select)="pickGame($event)"
              />
            }
          </div>

          @if (error()) {
            <p class="auth-notice auth-notice--error">{{ error() }}</p>
          }

          <div class="auth-actions">
            <button
              type="button"
              class="u-btn u-btn--primary u-btn--block"
              [disabled]="!selectedRole() || !selectedGame() || loading()"
              (click)="confirm()"
            >
              {{ loading() ? 'Sincronizando...' : 'Entrar al portal' }}
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

  readonly platforms = GAME_PLATFORM_LIST;
  readonly selectedRole = signal<UserRole | null>(null);
  readonly selectedGame = signal<SelectedGame | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  pickRole(role: UserRole): void {
    this.selectedRole.set(role);
    this.error.set(null);
  }

  pickGame(game: SelectedGame): void {
    this.selectedGame.set(game);
    this.error.set(null);
  }

  async confirm(): Promise<void> {
    const role = this.selectedRole();
    const game = this.selectedGame();
    const userId = this.auth.userId();
    if (!role || !game || !userId) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      await this.auth.updateUserRole(role);
      await this.auth.updateSelectedGame(game);

      const emailPrefix = (this.auth.email() ?? 'player').split('@')[0] ?? 'player';
      const gamerTag = emailPrefix.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'Player';

      await firstValueFrom(
        this.player.upsertPlayerProfile({
          userId,
          gamerTag,
          primaryPlatform: backendPlatformForGame(game),
        }),
      );

      await this.router.navigateByUrl(defaultHomeRouteForRole(role));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'No se pudo guardar tu selección');
    } finally {
      this.loading.set(false);
    }
  }
}
