import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  ViewEncapsulation,
} from '@angular/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import {
  buildDualTrendChartOptions,
  buildTrendChartOptions,
} from '../../../core/charts/echart-theme.util';
import type { TrendChartPoint } from '../trend-chart/trend-chart.component';

@Component({
  standalone: true,
  selector: 'sg-match-trends-panel',
  encapsulation: ViewEncapsulation.None,
  imports: [NgxEchartsDirective],
  template: `
    <section class="sg-match-trends u-surface-card u-p-4" aria-label="Tendencias de partidas">
      <header class="sg-match-trends__header">
        <div>
          <h2 class="sg-page-header__title u-text-md">Tendencias del período</h2>
          <p class="sg-page-header__subtitle u-m-0">
            Actividad diaria según los filtros activos.
          </p>
        </div>
      </header>

      @if (!hasData) {
        <p class="sg-trend-chart__empty u-m-0">Sin datos suficientes para graficar.</p>
      } @else {
        <div class="sg-match-trends__grid">
          <div class="sg-match-trends__chart">
            <h3 class="sg-match-trends__chart-title">Kills por día</h3>
            <div
              class="sg-trend-chart__canvas"
              echarts
              [options]="killsOptions"
              [autoResize]="true"
            ></div>
          </div>

          <div class="sg-match-trends__chart">
            <h3 class="sg-match-trends__chart-title">Partidas por día</h3>
            <div
              class="sg-trend-chart__canvas"
              echarts
              [options]="matchesOptions"
              [autoResize]="true"
            ></div>
          </div>

          <div class="sg-match-trends__chart sg-match-trends__chart--wide">
            <h3 class="sg-match-trends__chart-title">Kills vs partidas</h3>
            <div
              class="sg-trend-chart__canvas sg-trend-chart__canvas--tall"
              echarts
              [options]="comboOptions"
              [autoResize]="true"
            ></div>
          </div>

          <div class="sg-match-trends__chart">
            <h3 class="sg-match-trends__chart-title">Placement promedio</h3>
            <div
              class="sg-trend-chart__canvas"
              echarts
              [options]="placementOptions"
              [autoResize]="true"
            ></div>
          </div>
        </div>
      }
    </section>
  `,
})
export class MatchTrendsPanelComponent implements OnChanges {
  @Input() killsTrend: TrendChartPoint[] = [];
  @Input() matchesTrend: TrendChartPoint[] = [];
  @Input() placementTrend: TrendChartPoint[] = [];

  killsOptions: EChartsOption = {};
  matchesOptions: EChartsOption = {};
  comboOptions: EChartsOption = {};
  placementOptions: EChartsOption = {};

  get hasData(): boolean {
    return this.killsTrend.length > 0 || this.matchesTrend.length > 0;
  }

  ngOnChanges(_changes: SimpleChanges): void {
    this.killsOptions = buildTrendChartOptions(this.killsTrend, {
      variant: 'area',
      color: '#22d3ee',
      areaColor: 'rgba(34, 211, 238, 0.18)',
      yAxisName: 'kills',
    });

    this.matchesOptions = buildTrendChartOptions(this.matchesTrend, {
      variant: 'bar',
      color: '#22d3ee',
      yAxisName: 'matches',
    });

    this.placementOptions = buildTrendChartOptions(this.placementTrend, {
      variant: 'line',
      color: '#22d3ee',
      yAxisName: 'place',
    });

    this.comboOptions = buildDualTrendChartOptions(
      this.killsTrend,
      this.matchesTrend,
      { primary: 'Kills', secondary: 'Partidas' },
    );
  }
}
