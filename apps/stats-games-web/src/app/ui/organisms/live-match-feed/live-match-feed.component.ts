import { Component, Input, ViewEncapsulation } from '@angular/core';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';
import {
  MatchStatCardComponent,
  type MatchCardStats,
} from '../../molecules/match-stat-card/match-stat-card.component';

export interface LiveMatchFeedItem {
  matchId: string;
  platform: string;
  summary: string;
  updatedAt: string;
  live?: boolean;
  stats?: MatchCardStats;
}

/**
 * Organismo — feed de historial / live data estilo Tracker Network.
 */
@Component({
  standalone: true,
  selector: 'sg-live-match-feed',
  encapsulation: ViewEncapsulation.None,
  imports: [NeonBadgeComponent, MatchStatCardComponent],
  template: `
    <section class="sg-live-feed" aria-live="polite">
      <header class="sg-live-feed__header">
        <h2 class="sg-live-feed__title">{{ title }}</h2>
        @if (showLiveIndicator) {
          <sg-neon-badge tone="cyan" [pulse]="true" label="Live data stream">
            En vivo
          </sg-neon-badge>
        }
      </header>

      @if (items.length === 0) {
        <div class="sg-live-feed__empty">{{ emptyMessage }}</div>
      } @else {
        <div class="sg-live-feed__list">
          @for (item of items; track item.matchId + item.updatedAt) {
            <sg-match-stat-card
              [matchId]="item.matchId"
              [platform]="item.platform"
              [summary]="item.summary"
              [updatedAt]="item.updatedAt"
              [live]="item.live ?? false"
              [stats]="item.stats ?? {}"
              [clickable]="!item.live"
            />
          }
        </div>
      }
    </section>
  `,
})
export class LiveMatchFeedComponent {
  @Input() title = 'Historial de partidas';
  @Input() items: LiveMatchFeedItem[] = [];
  @Input() showLiveIndicator = false;
  @Input() emptyMessage = 'Sin partidas todavía. Esperando eventos…';
}
