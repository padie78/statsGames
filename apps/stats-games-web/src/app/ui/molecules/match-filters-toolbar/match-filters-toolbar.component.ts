import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { IonSelect, IonSelectOption } from '@ionic/angular/standalone';
import type { MatchSortKey } from '../../../utils/match-stats.util';

export type MatchPlatformFilter = 'all' | 'fortnite' | 'roblox';
export type MatchDateFilter = 'all' | '7d' | '30d';

@Component({
  standalone: true,
  selector: 'sg-match-filters-toolbar',
  encapsulation: ViewEncapsulation.None,
  imports: [IonSelect, IonSelectOption],
  template: `
    <section class="sg-match-filters u-surface-card u-p-4" aria-label="Filtros de partidas">
      <div class="sg-match-filters__row">
        <div class="sg-match-filters__group">
          <span class="sg-match-filters__label">Plataforma</span>
          <div class="sg-match-filters__chips" role="group" aria-label="Plataforma">
            @for (option of platformOptions; track option.value) {
              <button
                type="button"
                class="sg-match-filters__chip"
                [class.sg-match-filters__chip--active]="platform === option.value"
                [class.sg-match-filters__chip--fortnite]="option.value === 'fortnite'"
                [class.sg-match-filters__chip--roblox]="option.value === 'roblox'"
                (click)="platformChange.emit(option.value)"
              >
                {{ option.label }}
              </button>
            }
          </div>
        </div>

        <div class="sg-match-filters__group">
          <span class="sg-match-filters__label">Período</span>
          <div class="sg-match-filters__chips" role="group" aria-label="Período">
            @for (option of dateOptions; track option.value) {
              <button
                type="button"
                class="sg-match-filters__chip"
                [class.sg-match-filters__chip--active]="dateRange === option.value"
                (click)="dateRangeChange.emit(option.value)"
              >
                {{ option.label }}
              </button>
            }
          </div>
        </div>
      </div>

      <div class="sg-match-filters__footer">
        <p class="sg-match-filters__count">
          <strong>{{ resultCount }}</strong> partidas
          @if (usingMockData) {
            <span class="sg-match-filters__hint">· datos demo</span>
          }
        </p>

        <ion-select
          class="sg-match-filters__sort"
          label="Ordenar"
          labelPlacement="stacked"
          [value]="sort"
          (ionChange)="onSortChange($event)"
        >
          <ion-select-option value="newest">Más recientes</ion-select-option>
          <ion-select-option value="oldest">Más antiguas</ion-select-option>
          <ion-select-option value="placement">Mejor placement</ion-select-option>
          <ion-select-option value="kills">Más kills</ion-select-option>
        </ion-select>
      </div>
    </section>
  `,
})
export class MatchFiltersToolbarComponent {
  @Input() platform: MatchPlatformFilter = 'all';
  @Input() dateRange: MatchDateFilter = 'all';
  @Input() sort: MatchSortKey = 'newest';
  @Input() resultCount = 0;
  @Input() usingMockData = false;

  @Output() platformChange = new EventEmitter<MatchPlatformFilter>();
  @Output() dateRangeChange = new EventEmitter<MatchDateFilter>();
  @Output() sortChange = new EventEmitter<MatchSortKey>();

  readonly platformOptions = [
    { value: 'all' as const, label: 'Todas' },
    { value: 'fortnite' as const, label: 'Fortnite' },
    { value: 'roblox' as const, label: 'Roblox' },
  ];

  readonly dateOptions = [
    { value: 'all' as const, label: 'Todo' },
    { value: '7d' as const, label: '7 días' },
    { value: '30d' as const, label: '30 días' },
  ];

  onSortChange(event: CustomEvent): void {
    const value = (event.detail as { value?: MatchSortKey }).value;
    if (value) this.sortChange.emit(value);
  }
}
