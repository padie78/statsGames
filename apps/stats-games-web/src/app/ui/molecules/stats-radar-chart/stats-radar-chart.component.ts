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
import { buildStatsRadarOptions } from '../../../core/charts/echart-theme.util';
import {
  buildStatsRadarAxes,
  type StatsRadarAxis,
} from '../../../core/charts/stats-chart.util';
import type { PlayerStatsRollupView } from '../../../services/stats.service';

@Component({
  standalone: true,
  selector: 'sg-stats-radar-chart',
  encapsulation: ViewEncapsulation.None,
  imports: [NgxEchartsDirective],
  template: `
    <section class="sg-stats-radar u-surface-card" [attr.aria-label]="title">
      <header class="sg-trend-chart__header">
        <div>
          <h3 class="sg-trend-chart__title">{{ title }}</h3>
          @if (subtitle) {
            <p class="sg-stats-radar__subtitle">{{ subtitle }}</p>
          }
        </div>
      </header>

      @if (axes.length === 0) {
        <p class="sg-trend-chart__empty">Sin datos para el radar.</p>
      } @else {
        <div
          class="sg-trend-chart__canvas sg-trend-chart__canvas--radar"
          echarts
          [options]="chartOptions"
          [autoResize]="true"
        ></div>
      }
    </section>
  `,
})
export class StatsRadarChartComponent implements OnInit, OnChanges {
  @Input() title = 'Perfil de rendimiento';
  @Input() subtitle = 'Normalizado 0–100 vs objetivos semanales.';
  @Input() weekly: PlayerStatsRollupView | null = null;
  @Input() dailyTrend: PlayerStatsRollupView[] = [];

  axes: StatsRadarAxis[] = [];
  chartOptions: EChartsOption = {};

  ngOnInit(): void {
    this.refreshChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['weekly'] || changes['dailyTrend']) {
      this.refreshChart();
    }
  }

  private refreshChart(): void {
    this.axes = buildStatsRadarAxes(this.weekly, this.dailyTrend);
    this.chartOptions = buildStatsRadarOptions(this.axes);
  }
}
