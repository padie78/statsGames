import { Component, Input, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  gamePlatformMeta,
  type GamePlatformMeta,
} from '../../../core/game/game-platform.config';
import type { SelectedGame } from '../../../core/services/auth.service';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

@Component({
  standalone: true,
  selector: 'sg-platform-spotlight-card',
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink, NeonBadgeComponent],
  template: `
    <section
      class="sg-platform-spotlight"
      [attr.data-game]="platform"
    >
      <img
        class="sg-platform-spotlight__art"
        [src]="meta.artUrl"
        [alt]="meta.label"
        aria-hidden="true"
      />
      <div class="sg-platform-spotlight__overlay" aria-hidden="true"></div>

      <div class="sg-platform-spotlight__content">
        <div class="sg-platform-spotlight__head">
          <img
            class="sg-platform-spotlight__icon"
            [src]="meta.iconUrl"
            [alt]="meta.label"
          />
          <div>
            <p class="sg-platform-spotlight__eyebrow">Arena activa</p>
            <h2 class="sg-platform-spotlight__title">{{ meta.label }}</h2>
          </div>
          <sg-neon-badge [tone]="badgeTone">
            LIVE CONTEXT
          </sg-neon-badge>
        </div>

        <p class="sg-platform-spotlight__tagline">{{ meta.tagline }}</p>

        <div class="sg-platform-spotlight__stats">
          <div class="sg-platform-spotlight__stat">
            <span class="sg-platform-spotlight__stat-value">{{ winsWeek }}</span>
            <span class="sg-platform-spotlight__stat-label">Victorias</span>
          </div>
          <div class="sg-platform-spotlight__stat">
            <span class="sg-platform-spotlight__stat-value">{{ winRate }}</span>
            <span class="sg-platform-spotlight__stat-label">Win rate</span>
          </div>
          <div class="sg-platform-spotlight__stat">
            <span class="sg-platform-spotlight__stat-value">{{ totalKills }}</span>
            <span class="sg-platform-spotlight__stat-label">Eliminaciones</span>
          </div>
        </div>

        <div class="sg-platform-spotlight__actions">
          <a routerLink="/tabs/analytics" class="u-btn u-btn--ghost">Evolución</a>
          <a routerLink="/tabs/matches" class="u-btn u-btn--primary">Partidas</a>
        </div>
      </div>
    </section>
  `,
})
export class PlatformSpotlightCardComponent {
  @Input({ required: true }) platform!: SelectedGame;
  @Input() winsWeek: string | number = 0;
  @Input() winRate: string | number = '—';
  @Input() totalKills: string | number = 0;

  get meta(): GamePlatformMeta {
    return gamePlatformMeta(this.platform);
  }

  get badgeTone(): 'cyan' | 'purple' | 'lime' {
    if (this.platform === 'valorant' || this.platform === 'adopt_me') return 'purple';
    if (
      this.platform === 'blox_fruits' ||
      this.platform === 'brookhaven'
    ) {
      return 'lime';
    }
    return 'cyan';
  }
}
