import { Component, Input, ViewEncapsulation, inject } from '@angular/core';
import { GAME_PLATFORM_LIST } from '../../../core/game/game-platform.config';
import { GameContextService } from '../../../core/game/game-context.service';
import type { SelectedGame } from '../../../core/services/auth.service';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

/** Game picker estilo OP.GG — solo art propio + estado de cuenta. */
@Component({
  standalone: true,
  selector: 'sg-dual-platform-strip',
  encapsulation: ViewEncapsulation.None,
  imports: [NeonBadgeComponent],
  template: `
    <section class="sg-dual-platform sg-dual-platform--opgg" aria-label="Games">
      <header class="sg-dual-platform__header">
        <p class="sg-dual-platform__eyebrow">Games</p>
        <p class="sg-dual-platform__lead">Elegí la plataforma para ver tus stats y el coach.</p>
      </header>

      <div class="sg-dual-platform__rail">
        @for (p of platforms; track p.id) {
          <button
            type="button"
            class="sg-dual-platform__card"
            [class.sg-dual-platform__card--active]="activePlatform === p.id"
            [class.sg-dual-platform__card--roblox]="p.id === 'roblox'"
            [class.sg-dual-platform__card--fortnite]="p.id === 'fortnite'"
            [attr.aria-pressed]="activePlatform === p.id"
            [attr.aria-label]="'Abrir ' + p.label"
            [disabled]="gameContext.switching()"
            (click)="select(p.id)"
          >
            <img
              class="sg-dual-platform__art"
              [src]="p.portraitUrl"
              [alt]="p.label"
              loading="lazy"
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
  @Input() fortniteConnected = false;
  @Input() robloxConnected = false;

  readonly platforms = GAME_PLATFORM_LIST;

  isConnected(platform: SelectedGame): boolean {
    return platform === 'fortnite' ? this.fortniteConnected : this.robloxConnected;
  }

  select(game: SelectedGame): void {
    void this.gameContext.switchPlatform(game);
  }
}
