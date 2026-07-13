import { Component, Input, ViewEncapsulation, inject } from '@angular/core';
import { GAME_PLATFORM_LIST, gamePlatformMeta } from '../../../core/game/game-platform.config';
import { GameContextService } from '../../../core/game/game-context.service';
import {
  isRobloxExperienceGame,
  type SelectedGame,
} from '../../../core/game/selected-game';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

/** Game picker estilo OP.GG — grid de todos los juegos trackeados. */
@Component({
  standalone: true,
  selector: 'sg-dual-platform-strip',
  encapsulation: ViewEncapsulation.None,
  imports: [NeonBadgeComponent],
  template: `
    <section class="sg-dual-platform sg-dual-platform--opgg" aria-label="Games">
      <header class="sg-dual-platform__header">
        <p class="sg-dual-platform__eyebrow">Games</p>
        <p class="sg-dual-platform__lead">Elegí el juego para ver stats, badges y coach.</p>
      </header>

      <div class="sg-dual-platform__rail">
        @for (p of platforms; track p.id) {
          <button
            type="button"
            class="sg-dual-platform__card"
            [class.sg-dual-platform__card--active]="activePlatform === p.id"
            [attr.data-game]="p.id"
            [attr.aria-pressed]="activePlatform === p.id"
            [attr.aria-label]="'Abrir ' + p.label"
            [disabled]="gameContext.switching()"
            (click)="select(p.id)"
          >
            <img
              class="sg-dual-platform__art"
              [src]="p.portraitUrl"
              [attr.data-fallback]="p.portraitFallbackUrl"
              [alt]="p.label"
              loading="lazy"
              (error)="onPortraitError($event)"
            />
            <div class="sg-dual-platform__overlay" aria-hidden="true"></div>
            <div class="sg-dual-platform__top">
              <sg-neon-badge
                [tone]="activePlatform === p.id ? 'lime' : isConnected(p.id) ? 'cyan' : 'muted'"
                [pulse]="activePlatform === p.id"
              >
                {{ activePlatform === p.id ? 'ACTIVA' : isConnected(p.id) ? 'LINKED' : 'OFF' }}
              </sg-neon-badge>
            </div>
            <div class="sg-dual-platform__body">
              <img class="sg-dual-platform__icon" [src]="p.iconUrl" [alt]="" aria-hidden="true" />
              <h3 class="sg-dual-platform__name">{{ p.label }}</h3>
              <p class="sg-dual-platform__hint">{{ p.statsHint }}</p>
            </div>
          </button>
        }
      </div>
    </section>
  `,
})
export class DualPlatformStripComponent {
  readonly gameContext = inject(GameContextService);

  @Input() activePlatform: SelectedGame = 'fortnite';
  @Input() valorantConnected = false;
  @Input() leagueOfLegendsConnected = false;
  @Input() cs2Connected = false;
  @Input() rocketLeagueConnected = false;
  @Input() fortniteConnected = false;
  @Input() robloxConnected = false;

  readonly platforms = GAME_PLATFORM_LIST;

  onPortraitError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const fallback = img.getAttribute('data-fallback');
    if (fallback && img.src !== fallback) {
      img.src = fallback;
    }
  }

  isConnected(platform: SelectedGame): boolean {
    if (platform === 'valorant') return this.valorantConnected;
    if (platform === 'league_of_legends') return this.leagueOfLegendsConnected;
    if (platform === 'cs2') return this.cs2Connected;
    if (platform === 'rocket_league') return this.rocketLeagueConnected;
    if (platform === 'fortnite') return this.fortniteConnected;
    if (isRobloxExperienceGame(platform)) return this.robloxConnected;
    return false;
  }

  select(game: SelectedGame): void {
    void this.gameContext.switchPlatform(game);
  }

  label(game: SelectedGame): string {
    return gamePlatformMeta(game).label;
  }
}
