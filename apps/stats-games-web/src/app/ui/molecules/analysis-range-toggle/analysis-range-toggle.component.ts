import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import {
  ANALYSIS_RANGE_OPTIONS,
  todayPeriodId,
  type AnalysisRangeId,
} from '../../../core/analysis/analysis-range';
import { DatePickerComponent } from '../../atoms/date-picker/date-picker.component';

@Component({
  standalone: true,
  selector: 'sg-analysis-range-toggle',
  encapsulation: ViewEncapsulation.None,
  imports: [DatePickerComponent],
  template: `
    <div class="sg-analysis-range-wrap">
      <div class="sg-analysis-range" role="group" [attr.aria-label]="ariaLabel">
        @for (opt of options; track opt.id) {
          <button
            type="button"
            class="sg-analysis-range__btn"
            [class.sg-analysis-range__btn--active]="value === opt.id"
            [attr.title]="opt.description"
            (click)="onSelect(opt.id)"
          >
            <span class="sg-analysis-range__short">{{ opt.shortLabel }}</span>
            <span class="sg-analysis-range__full">{{ opt.label }}</span>
          </button>
        }
      </div>

      @if (value === 'day') {
        <sg-date-picker
          class="sg-analysis-range__day-picker"
          label="Fecha"
          [value]="selectedDayIso"
          [max]="maxDay"
          (valueChange)="dayChange.emit($event)"
        />
      }
    </div>
  `,
})
export class AnalysisRangeToggleComponent {
  @Input() value: AnalysisRangeId = 'week';
  @Input() selectedDayIso = todayPeriodId();
  @Input() ariaLabel = 'Rango de análisis';
  @Output() readonly rangeChange = new EventEmitter<AnalysisRangeId>();
  @Output() readonly dayChange = new EventEmitter<string>();

  readonly options = ANALYSIS_RANGE_OPTIONS;
  readonly maxDay = todayPeriodId();

  onSelect(id: AnalysisRangeId): void {
    if (id === this.value) return;
    this.rangeChange.emit(id);
  }
}
