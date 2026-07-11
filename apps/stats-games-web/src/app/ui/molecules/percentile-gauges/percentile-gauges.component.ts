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
import {
  buildPercentileGaugesOptions,
  type PercentileGaugeItem,
} from '../../../core/charts/echart-theme.util';
import type { CommunityComparisonItem } from '../../../utils/community-stats.util';

@Component({
  standalone: true,
  selector: 'sg-percentile-gauges',
  encapsulation: ViewEncapsulation.None,
  imports: [NgxEchartsDirective],
  template: `
    <section class="sg-percentile-gauges u-surface-card u-p-5" aria-label="Gauges de percentiles">
      <header class="sg-percentile-gauges__header">
        <div>
          <p class="sg-percentile-gauges__eyebrow">Vista gráfica</p>
          <h3 class="sg-percentile-gauges__title">{{ title }}</h3>
        </div>
        @if (subtitle) {
          <p class="sg-percentile-gauges__subtitle u-m-0">{{ subtitle }}</p>
        }
      </header>

      @if (!gaugeItems.length) {
        <p class="sg-trend-chart__empty u-m-0">Sin percentiles para graficar.</p>
      } @else {
        <div
          class="sg-percentile-gauges__canvas"
          echarts
          [options]="chartOptions"
          [autoResize]="true"
        ></div>
      }
    </section>
  `,
})
export class PercentileGaugesComponent implements OnInit, OnChanges {
  @Input() title = 'Percentiles de un vistazo';
  @Input() subtitle = 'Cuánto de la comunidad superás en cada KPI.';
  @Input() items: CommunityComparisonItem[] = [];

  gaugeItems: PercentileGaugeItem[] = [];
  chartOptions: EChartsOption = {};

  ngOnInit(): void {
    this.refresh();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['items']) this.refresh();
  }

  private refresh(): void {
    this.gaugeItems = this.items.slice(0, 4).map((item) => ({
      name: item.label.replace(' / semana', ''),
      value: item.betterThanPct,
      tone: item.tone,
    }));
    this.chartOptions = buildPercentileGaugesOptions(this.gaugeItems);
  }
}
