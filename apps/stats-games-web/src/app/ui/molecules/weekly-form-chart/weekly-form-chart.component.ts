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
import type { WeeklyFormPoint } from '../../../core/charts/stats-chart.util';
import {
  buildWeeklyFairScoreChartOptions,
  buildWeeklyFormChartOptions,
} from '../../../core/charts/echart-theme.util';

export type WeeklyFormChartVariant = 'wr-kd' | 'fair-score';

@Component({
  standalone: true,
  selector: 'sg-weekly-form-chart',
  encapsulation: ViewEncapsulation.None,
  imports: [NgxEchartsDirective],
  template: `
    <section class="sg-weekly-form u-surface-card" [attr.aria-label]="title">
      <header class="sg-weekly-form__header">
        <div>
          <h3 class="sg-weekly-form__title">{{ title }}</h3>
          @if (subtitle) {
            <p class="sg-weekly-form__subtitle u-m-0">{{ subtitle }}</p>
          }
        </div>
        @if (badgeLabel) {
          <span class="sg-weekly-form__unit">{{ badgeLabel }}</span>
        }
      </header>

      @if (!points.length) {
        <p class="sg-trend-chart__empty u-m-0">Sin partidas suficientes para armar la forma semanal.</p>
      } @else {
        <div
          class="sg-weekly-form__canvas"
          echarts
          [options]="chartOptions"
          [autoResize]="true"
        ></div>
      }
    </section>
  `,
})
export class WeeklyFormChartComponent implements OnInit, OnChanges {
  @Input() title = 'Forma en el tiempo';
  @Input() subtitle = '';
  @Input() kdLabel = 'K/D';
  @Input() variant: WeeklyFormChartVariant = 'wr-kd';
  @Input() points: WeeklyFormPoint[] = [];
  /** Mediana de score de la muestra por semana (solo fair-score). */
  @Input() peerMedian: Array<number | null> = [];

  chartOptions: EChartsOption = {};

  get badgeLabel(): string {
    if (this.variant === 'fair-score') {
      return this.peerMedian.some((v) => v != null) ? 'Vos · mediana' : 'Score justo';
    }
    return `WR · ${this.kdLabel}`;
  }

  ngOnInit(): void {
    this.refresh();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['points'] ||
      changes['kdLabel'] ||
      changes['variant'] ||
      changes['peerMedian']
    ) {
      this.refresh();
    }
  }

  private refresh(): void {
    const points = this.points ?? [];
    this.chartOptions =
      this.variant === 'fair-score'
        ? buildWeeklyFairScoreChartOptions(points, this.peerMedian)
        : buildWeeklyFormChartOptions(points, this.kdLabel);
  }
}
