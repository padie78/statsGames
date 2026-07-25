import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import {
  ANALYSIS_RANGE_OPTIONS,
  type AnalysisRangeId,
} from '../../../core/analysis/analysis-range';

@Component({
  standalone: true,
  selector: 'sg-analysis-range-toggle',
  encapsulation: ViewEncapsulation.None,
  template: `
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
  `,
})
export class AnalysisRangeToggleComponent {
  @Input() value: AnalysisRangeId = 'week';
  @Input() ariaLabel = 'Rango de análisis';
  @Output() readonly rangeChange = new EventEmitter<AnalysisRangeId>();

  readonly options = ANALYSIS_RANGE_OPTIONS;

  onSelect(id: AnalysisRangeId): void {
    if (id === this.value) return;
    this.rangeChange.emit(id);
  }
}
