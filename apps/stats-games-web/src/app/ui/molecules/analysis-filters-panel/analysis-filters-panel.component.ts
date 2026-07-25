import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import {
  ANALYSIS_RANGE_OPTIONS,
  todayPeriodId,
  type AnalysisRangeId,
} from '../../../core/analysis/analysis-range';

/**
 * Panel de período unificado (misma cáscara visual que Partidas).
 * Sin búsqueda/resultado/mapa: esos filtros solo aplican al historial de matches.
 */
@Component({
  standalone: true,
  selector: 'sg-analysis-filters-panel',
  encapsulation: ViewEncapsulation.None,
  template: `
    <section class="sg-match-filters u-surface-card u-p-5" [attr.aria-label]="ariaLabel">
      <div class="sg-match-filters__top">
        <div class="sg-match-filters__top-badges">
          <span class="sg-analysis-filters__title">{{ title }}</span>
          @if (subtitle) {
            <span class="sg-analysis-filters__subtitle">{{ subtitle }}</span>
          }
        </div>
      </div>

      <div class="sg-match-filters__row">
        <div class="sg-match-filters__group">
          <span class="sg-match-filters__label">Período</span>
          <div class="sg-match-filters__chips" role="group" aria-label="Período">
            @for (option of options; track option.id) {
              <button
                type="button"
                class="sg-match-filters__chip"
                [class.sg-match-filters__chip--active]="value === option.id"
                [attr.title]="option.description"
                (click)="onSelect(option.id)"
              >
                <span class="sg-match-filters__chip-short">{{ option.shortLabel }}</span>
                <span class="sg-match-filters__chip-full">{{ option.label }}</span>
              </button>
            }
          </div>
          @if (value === 'day') {
            <label class="sg-match-filters__day">
              <span class="sg-match-filters__day-label">Fecha</span>
              <input
                type="date"
                class="sg-match-filters__day-input"
                [value]="selectedDayIso"
                [max]="maxDay"
                (change)="onDayInput($event)"
              />
            </label>
          }
        </div>
      </div>
    </section>
  `,
})
export class AnalysisFiltersPanelComponent {
  @Input() value: AnalysisRangeId = 'week';
  @Input() selectedDayIso = todayPeriodId();
  @Input() title = 'Filtros';
  @Input() subtitle = '';
  @Input() ariaLabel = 'Filtros de análisis';
  @Output() readonly rangeChange = new EventEmitter<AnalysisRangeId>();
  @Output() readonly dayChange = new EventEmitter<string>();

  readonly options = ANALYSIS_RANGE_OPTIONS;
  readonly maxDay = todayPeriodId();

  onSelect(id: AnalysisRangeId): void {
    if (id === this.value) return;
    this.rangeChange.emit(id);
  }

  onDayInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (!value) return;
    this.dayChange.emit(value);
  }
}
