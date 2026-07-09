import { Component, Input, ViewEncapsulation } from '@angular/core';
import { StatValueComponent, type StatAccent } from '../../atoms/stat-value/stat-value.component';

export interface KpiStripItem {
  label: string;
  value: string | number;
  accent?: StatAccent;
  delta?: string;
  deltaTrend?: 'up' | 'down' | 'flat';
}

@Component({
  standalone: true,
  selector: 'sg-kpi-strip',
  encapsulation: ViewEncapsulation.None,
  imports: [StatValueComponent],
  template: `
    <section class="sg-kpi-strip" [attr.aria-label]="title">
      @if (title) {
        <h2 class="sg-kpi-strip__title">{{ title }}</h2>
      }
      <div class="sg-kpi-strip__grid">
        @for (kpi of items; track kpi.label) {
          <div class="sg-kpi-strip__cell u-surface-card u-p-3">
            <sg-stat-value
              [label]="kpi.label"
              [value]="kpi.value"
              [accent]="kpi.accent ?? 'default'"
              [delta]="kpi.delta"
              [deltaTrend]="kpi.deltaTrend ?? 'flat'"
            />
          </div>
        }
      </div>
    </section>
  `,
})
export class KpiStripComponent {
  @Input() title = '';
  @Input({ required: true }) items: KpiStripItem[] = [];
}
