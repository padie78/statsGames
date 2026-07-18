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
import type { TrendChartPoint } from '../../../core/charts/chart.types';
import {
  buildTrendChartOptions,
  type TrendChartVariant,
} from '../../../core/charts/echart-theme.util';

export type { TrendChartPoint };

@Component({
  standalone: true,
  selector: 'sg-trend-chart',
  encapsulation: ViewEncapsulation.None,
  imports: [NgxEchartsDirective],
  template: `
    <section class="sg-trend-chart u-surface-card" [attr.aria-label]="title">
      <header class="sg-trend-chart__header">
        <div class="sg-trend-chart__heading">
          <h3 class="sg-trend-chart__title">{{ title }}</h3>
          @if (subtitle) {
            <p class="sg-trend-chart__subtitle u-m-0">{{ subtitle }}</p>
          }
        </div>
        @if (unit) {
          <span class="sg-trend-chart__unit">{{ unit }}</span>
        }
      </header>

      @if (points.length === 0) {
        <p class="sg-trend-chart__empty">Sin datos para el período.</p>
      } @else {
        <div
          class="sg-trend-chart__canvas"
          echarts
          [options]="chartOptions"
          [autoResize]="true"
        ></div>
      }
    </section>
  `,
})
export class TrendChartComponent implements OnInit, OnChanges {
  @Input() title = 'Tendencia';
  @Input() subtitle = '';
  @Input() unit = '';
  @Input() points: TrendChartPoint[] = [];
  @Input() variant: TrendChartVariant = 'bar';
  @Input() color = '#f0d060';
  @Input() areaColor = 'rgba(240, 208, 96, 0.2)';

  chartOptions: EChartsOption = {};

  ngOnInit(): void {
    this.refreshOptions();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['points'] ||
      changes['variant'] ||
      changes['color'] ||
      changes['areaColor'] ||
      changes['unit']
    ) {
      this.refreshOptions();
    }
  }

  private refreshOptions(): void {
    this.chartOptions = buildTrendChartOptions(this.points, {
      variant: this.variant,
      color: this.color,
      areaColor: this.areaColor,
      yAxisName: this.unit || undefined,
    });
  }
}
