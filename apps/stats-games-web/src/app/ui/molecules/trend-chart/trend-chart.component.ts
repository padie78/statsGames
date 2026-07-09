import { Component, Input, ViewEncapsulation } from '@angular/core';

export interface TrendChartPoint {
  label: string;
  value: number;
}

@Component({
  standalone: true,
  selector: 'sg-trend-chart',
  encapsulation: ViewEncapsulation.None,
  template: `
    <section class="sg-trend-chart" [attr.aria-label]="title">
      <header class="sg-trend-chart__header">
        <h3 class="sg-trend-chart__title">{{ title }}</h3>
        @if (unit) {
          <span class="sg-trend-chart__unit">{{ unit }}</span>
        }
      </header>

      @if (points.length === 0) {
        <p class="sg-trend-chart__empty">Sin datos para el período.</p>
      } @else {
        <div class="sg-trend-chart__bars">
          @for (point of points; track point.label) {
            <div class="sg-trend-chart__bar-col">
              <div
                class="sg-trend-chart__bar"
                [style.height.%]="barHeight(point.value)"
                [attr.title]="point.label + ': ' + point.value"
              ></div>
              <span class="sg-trend-chart__label">{{ point.label }}</span>
            </div>
          }
        </div>
      }
    </section>
  `,
})
export class TrendChartComponent {
  @Input() title = 'Tendencia';
  @Input() unit = '';
  @Input() points: TrendChartPoint[] = [];

  barHeight(value: number): number {
    const max = Math.max(...this.points.map((p) => p.value), 1);
    return Math.max(8, (value / max) * 100);
  }
}
