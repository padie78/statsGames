import { Component, Input, ViewEncapsulation } from '@angular/core';
import type { MatchDayGroup } from '../../../utils/match-stats.util';
import {
  MatchStatCardComponent,
  type MatchCardStats,
} from '../../molecules/match-stat-card/match-stat-card.component';

export interface MatchHistoryListItem {
  matchId: string;
  platform: string;
  summary: string;
  updatedAt: string;
  relativeTime: string;
  stats: MatchCardStats;
  live?: boolean;
}

@Component({
  standalone: true,
  selector: 'sg-match-history-list',
  encapsulation: ViewEncapsulation.None,
  imports: [MatchStatCardComponent],
  template: `
    <section class="sg-match-history" aria-label="Historial de partidas">
      @if (groups.length === 0) {
        <div class="sg-match-history__empty u-surface-card u-p-5">{{ emptyMessage }}</div>
      } @else {
        @for (group of groups; track group.id) {
          <div class="sg-match-history__group">
            <header class="sg-match-history__group-header">
              <h2 class="sg-match-history__group-title">{{ group.label }}</h2>
              <span class="sg-match-history__group-count">{{ group.items.length }}</span>
            </header>

            <div class="sg-match-history__list">
              @for (item of group.items; track item.matchId + item.updatedAt) {
                <sg-match-stat-card
                  [matchId]="item.matchId"
                  [platform]="item.platform"
                  [summary]="item.summary"
                  [updatedAt]="item.updatedAt"
                  [relativeTime]="item.relativeTime"
                  [live]="item.live ?? false"
                  [stats]="item.stats"
                  [detailed]="true"
                />
              }
            </div>
          </div>
        }
      }
    </section>
  `,
})
export class MatchHistoryListComponent {
  @Input() groups: Array<MatchDayGroup & { items: MatchHistoryListItem[] }> = [];
  @Input() emptyMessage = 'Sin partidas para mostrar.';
}
