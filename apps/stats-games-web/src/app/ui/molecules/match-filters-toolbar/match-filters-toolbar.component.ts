import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectComponent, type SelectOption } from '../../atoms/select/select.component';
import type { MatchSortKey } from '../../../utils/match-stats.util';

export type MatchDateFilter = 'all' | '7d' | '30d';
export type MatchResultFilter = 'all' | 'wins' | 'losses';

@Component({
  standalone: true,
  selector: 'sg-match-filters-toolbar',
  encapsulation: ViewEncapsulation.None,
  imports: [FormsModule, SelectComponent],
  template: `
    <section class="sg-match-filters u-surface-card u-p-5" aria-label="Filtros de partidas">
      <div class="sg-match-filters__search">
        <label class="sg-match-filters__label" for="sg-match-search">Buscar</label>
        <div class="sg-match-filters__search-field">
          <input
            id="sg-match-search"
            type="search"
            class="sg-match-filters__search-input"
            placeholder="Campeón, agente, mapa, modo, resumen…"
            [ngModel]="query"
            (ngModelChange)="queryChange.emit($event)"
            autocomplete="off"
            spellcheck="false"
          />
          @if (query.trim()) {
            <button
              type="button"
              class="sg-match-filters__search-clear"
              aria-label="Limpiar búsqueda"
              (click)="queryChange.emit('')"
            >
              ×
            </button>
          }
        </div>
      </div>

      <div class="sg-match-filters__row">
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

        <div class="sg-match-filters__group">
          <span class="sg-match-filters__label">Resultado</span>
          <div class="sg-match-filters__chips" role="group" aria-label="Resultado">
            @for (option of resultOptions; track option.value) {
              <button
                type="button"
                class="sg-match-filters__chip"
                [class.sg-match-filters__chip--active]="result === option.value"
                (click)="resultChange.emit(option.value)"
              >
                {{ option.label }}
              </button>
            }
          </div>
        </div>
      </div>

      <div class="sg-match-filters__selects sg-match-filters__selects--full">
        <sg-select
          class="sg-match-filters__select"
          label="Modo"
          [options]="modeSelectOptions"
          [value]="mode"
          (valueChange)="modeChange.emit($event)"
        />
        <sg-select
          class="sg-match-filters__select"
          [label]="identityLabel"
          [options]="identitySelectOptions"
          [value]="identity"
          (valueChange)="identityChange.emit($event)"
        />
        <sg-select
          class="sg-match-filters__select"
          label="Mapa"
          [options]="mapSelectOptions"
          [value]="map"
          (valueChange)="mapChange.emit($event)"
        />
      </div>

      <div class="sg-match-filters__footer">
        <div class="sg-match-filters__footer-meta">
          <p class="sg-match-filters__count">
            <strong>{{ resultCount }}</strong> partidas
            @if (usingMockData) {
              <span class="sg-match-filters__hint">· datos demo</span>
            }
          </p>
          @if (hasActiveFilters) {
            <button type="button" class="sg-match-filters__reset" (click)="clearFilters.emit()">
              Limpiar filtros
            </button>
          }
        </div>

        <sg-select
          class="sg-match-filters__sort"
          label="Ordenar"
          [options]="sortOptions"
          [value]="sort"
          (valueChange)="onSortChange($event)"
        />
      </div>
    </section>
  `,
})
export class MatchFiltersToolbarComponent {
  @Input() dateRange: MatchDateFilter = 'all';
  @Input() result: MatchResultFilter = 'all';
  @Input() sort: MatchSortKey = 'newest';
  @Input() query = '';
  @Input() mode = 'all';
  @Input() identity = 'all';
  @Input() map = 'all';
  @Input() modeOptions: string[] = [];
  @Input() identityOptions: string[] = [];
  @Input() mapOptions: string[] = [];
  @Input() identityLabel = 'Campeón / agente';
  @Input() resultCount = 0;
  @Input() usingMockData = false;
  @Input() hasActiveFilters = false;

  @Output() dateRangeChange = new EventEmitter<MatchDateFilter>();
  @Output() resultChange = new EventEmitter<MatchResultFilter>();
  @Output() sortChange = new EventEmitter<MatchSortKey>();
  @Output() queryChange = new EventEmitter<string>();
  @Output() modeChange = new EventEmitter<string>();
  @Output() identityChange = new EventEmitter<string>();
  @Output() mapChange = new EventEmitter<string>();
  @Output() clearFilters = new EventEmitter<void>();

  readonly dateOptions = [
    { value: 'all' as const, label: 'Todo' },
    { value: '7d' as const, label: '7 días' },
    { value: '30d' as const, label: '30 días' },
  ];

  readonly resultOptions = [
    { value: 'all' as const, label: 'Todos' },
    { value: 'wins' as const, label: 'Victorias' },
    { value: 'losses' as const, label: 'Derrotas' },
  ];

  readonly sortOptions: SelectOption<MatchSortKey>[] = [
    { value: 'newest', label: 'Más recientes' },
    { value: 'oldest', label: 'Más antiguas' },
    { value: 'placement', label: 'Mejor placement' },
    { value: 'kills', label: 'Más kills' },
  ];

  get modeSelectOptions(): SelectOption[] {
    return this.toSelectOptions(this.modeOptions, 'Todos los modos');
  }

  get identitySelectOptions(): SelectOption[] {
    return this.toSelectOptions(this.identityOptions, `Todos · ${this.identityLabel}`);
  }

  get mapSelectOptions(): SelectOption[] {
    return this.toSelectOptions(this.mapOptions, 'Todos los mapas');
  }

  onSortChange(value: string): void {
    this.sortChange.emit(value as MatchSortKey);
  }

  private toSelectOptions(values: string[], allLabel: string): SelectOption[] {
    return [
      { value: 'all', label: allLabel },
      ...values.map((value) => ({ value, label: value })),
    ];
  }
}
