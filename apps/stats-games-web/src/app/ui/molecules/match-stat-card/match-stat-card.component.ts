import { Component, Input, ViewEncapsulation } from '@angular/core';
import { gamePlatformMeta } from '../../../core/game/game-platform.config';
import type { SelectedGame } from '../../../core/services/auth.service';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';
import { StatValueComponent } from '../../atoms/stat-value/stat-value.component';

export interface MatchCardStats {
  kills?: number | null;
  deaths?: number | null;
  placement?: number | null;
  assists?: number | null;
}

/**
 * Molécula — tarjeta densa de partida (grilla TRN).
 * Consume átomos NeonBadge + StatValue. Sin CSS local.
 */
@Component({
  standalone: true,
  selector: 'sg-match-stat-card',
  encapsulation: ViewEncapsulation.None,
  imports: [NeonBadgeComponent, StatValueComponent],
  template: `
    <article
      class="sg-match-card"
      [class.sg-match-card--live]="live"
      [class.sg-match-card--fortnite]="platformKey === 'fortnite'"
      [class.sg-match-card--roblox]="platformKey === 'roblox'"
    >
      <header class="sg-match-card__header">
        <div class="sg-match-card__meta">
          <div class="sg-match-card__title-row">
            <span
              class="sg-match-card__thumb"
              [style.background-image]="platformIconUrl ? 'url(' + platformIconUrl + ')' : null"
              aria-hidden="true"
            ></span>
            <h3 class="sg-match-card__title">{{ platformLabel }} · {{ matchId }}</h3>
          </div>
          <p class="sg-match-card__subtitle">{{ updatedAt }}</p>
        </div>
        <div class="u-flex u-gap-2 u-items-center">
          @if (live) {
            <sg-neon-badge tone="lime" [pulse]="true">LIVE</sg-neon-badge>
          }
          <sg-neon-badge [tone]="platformTone">{{ platform }}</sg-neon-badge>
        </div>
      </header>

      @if (summary) {
        <p class="sg-match-card__summary">{{ summary }}</p>
      }

      <div class="sg-match-card__stats">
        <sg-stat-value
          label="Kills"
          [value]="stats.kills ?? '—'"
          accent="lime"
        />
        <sg-stat-value
          label="Deaths"
          [value]="stats.deaths ?? '—'"
          accent="pink"
        />
        <sg-stat-value
          label="Place"
          [value]="stats.placement != null ? '#' + stats.placement : '—'"
          accent="purple"
        />
      </div>
    </article>
  `,
})
export class MatchStatCardComponent {
  @Input({ required: true }) matchId!: string;
  @Input({ required: true }) platform!: string;
  @Input() summary = '';
  @Input() updatedAt = '';
  @Input() live = false;
  @Input() stats: MatchCardStats = {};

  get platformTone(): 'cyan' | 'purple' | 'muted' {
    if (this.platformKey === 'fortnite') return 'cyan';
    if (this.platformKey === 'roblox') return 'purple';
    return 'muted';
  }

  get platformKey(): SelectedGame | null {
    const p = this.platform?.toLowerCase();
    if (p === 'fortnite' || p === 'roblox') return p;
    return null;
  }

  get platformLabel(): string {
    if (this.platformKey) return gamePlatformMeta(this.platformKey).label;
    return this.platform;
  }

  get platformIconUrl(): string | null {
    if (!this.platformKey) return null;
    return gamePlatformMeta(this.platformKey).iconUrl;
  }
}
