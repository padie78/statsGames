import { Component, Input, ViewEncapsulation } from '@angular/core';
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
    <article class="sg-match-card" [class.sg-match-card--live]="live">
      <header class="sg-match-card__header">
        <div class="sg-match-card__meta">
          <h3 class="sg-match-card__title">{{ platform }} · {{ matchId }}</h3>
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
    const p = this.platform?.toLowerCase();
    if (p === 'fortnite') return 'cyan';
    if (p === 'roblox') return 'purple';
    return 'muted';
  }
}
