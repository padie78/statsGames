import {
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  ViewEncapsulation,
} from '@angular/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import { buildYouVsBenchmarkChartOptions } from '../../../core/charts/echart-theme.util';

export interface StatsComparisonRow {
  label: string;
  you: number;
  benchmark: number;
}

@Component({
  standalone: true,
  selector: 'sg-stats-comparison-chart',
  encapsulation: ViewEncapsulation.None,
  imports: [NgxEchartsDirective],
  template: `
    <section class="sg-stats-compare u-surface-card u-p-5" [attr.aria-label]="title">
      <header class="sg-stats-compare__header">
        <div>
          <p class="sg-stats-compare__eyebrow">Comparación</p>
          <h3 class="sg-stats-compare__title">{{ title }}</h3>
          @if (subtitle) {
            <p class="sg-stats-compare__subtitle u-m-0">{{ subtitle }}</p>
          }
        </div>
      </header>

      @if (!rows.length) {
        <p class="sg-trend-chart__empty u-m-0">Sin datos para comparar.</p>
      } @else {
        <div
          class="sg-stats-compare__canvas"
          echarts
          [options]="chartOptions"
          [autoResize]="true"
        ></div>
      }
    </section>
  `,
})
export class StatsComparisonChartComponent implements OnInit, OnChanges {
  @Input() title = 'Vos vs comunidad';
  @Input() subtitle = 'Valores de esta semana frente al promedio de la muestra.';
  @Input() rows: StatsComparisonRow[] = [];
  @Input() youLabel = 'Vos';
  @Input() benchmarkLabel = 'Comunidad';

  chartOptions: EChartsOption = {};

  ngOnInit(): void {
    this.refresh();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['rows'] ||
      changes['youLabel'] ||
      changes['benchmarkLabel']
    ) {
      this.refresh();
    }
  }

  private refresh(): void {
    this.chartOptions = buildYouVsBenchmarkChartOptions(this.rows, {
      you: this.youLabel,
      benchmark: this.benchmarkLabel,
    });
  }
}
