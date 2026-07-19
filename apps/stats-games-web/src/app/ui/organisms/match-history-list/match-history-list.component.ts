import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import type { MatchDayGroup } from '../../../utils/match-stats.util';
import { sgFadeSlideIn, sgListItem, sgListStagger } from '../../animations/sg-motion';
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
  fresh?: boolean;
}

@Component({
  standalone: true,
  selector: 'sg-match-history-list',
  encapsulation: ViewEncapsulation.None,
  imports: [MatchStatCardComponent],
  animations: [sgFadeSlideIn, sgListStagger, sgListItem],
  template: `
    <div class="sg-match-history" aria-label="Historial de partidas">
      @if (groups.length === 0) {
        <p class="sg-match-history__empty u-m-0 u-surface-card u-p-5" @sgFadeSlideIn>
          {{ emptyMessage }}
        </p>
      } @else {
        @for (group of groups; track group.id) {
          <div class="sg-match-history__group" @sgFadeSlideIn>
            <header class="sg-match-history__group-header">
              <h3 class="sg-match-history__group-title">{{ group.label }}</h3>
              <span class="sg-match-history__group-count">{{ group.items.length }}</span>
            </header>

            <div class="sg-match-history__list" [@sgListStagger]="group.items.length">
              @for (item of group.items; track item.matchId + item.updatedAt) {
                <div class="sg-match-history__item" @sgListItem>
                  <sg-match-stat-card
                    [matchId]="item.matchId"
                    [platform]="item.platform"
                    [summary]="item.summary"
                    [updatedAt]="item.updatedAt"
                    [relativeTime]="item.relativeTime"
                    [live]="item.live ?? false"
                    [fresh]="item.fresh ?? false"
                    [stats]="item.stats"
                    [detailed]="true"
                    [clickable]="clickable"
                    [openMode]="openMode"
                    (openMatch)="matchSelect.emit(item)"
                  />
                </div>
              }
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class MatchHistoryListComponent {
  @Input() groups: Array<MatchDayGroup & { items: MatchHistoryListItem[] }> = [];
  @Input() emptyMessage = 'Sin partidas para mostrar.';
  @Input() clickable = true;
  @Input() openMode: 'route' | 'event' = 'event';
  @Output() readonly matchSelect = new EventEmitter<MatchHistoryListItem>();
}
