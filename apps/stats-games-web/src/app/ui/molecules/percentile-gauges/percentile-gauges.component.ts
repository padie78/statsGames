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
        <p class="sg-trend-chart__empty u-m-0">
          Sin percentiles para graficar. Jugá partidas esta semana para comparar vs la comunidad.
        </p>
      } @else {
        <!-- Remount echarts when data arrives (evita canvas vacío tras options {}). -->
        @for (key of [chartKey]; track key) {
          <div
            class="sg-percentile-gauges__canvas"
            echarts
            [options]="chartOptions"
            [autoResize]="true"
          ></div>
        }

        <ul class="sg-percentile-gauges__bars" aria-label="Detalle de percentiles">
          @for (item of gaugeItems; track item.name) {
            <li class="sg-percentile-gauges__bar" [attr.data-tone]="item.tone ?? 'strong'">
              <div class="sg-percentile-gauges__bar-head">
                <span class="sg-percentile-gauges__bar-name">{{ item.name }}</span>
                <strong class="sg-percentile-gauges__bar-value">{{ item.value }}%</strong>
              </div>
              <div class="sg-percentile-gauges__bar-track" aria-hidden="true">
                <span
                  class="sg-percentile-gauges__bar-fill"
                  [style.width.%]="item.value"
                ></span>
              </div>
              <p class="sg-percentile-gauges__bar-hint u-m-0">
                Mejor que el {{ item.value }}% de la comunidad
              </p>
            </li>
          }
        </ul>
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
  chartKey = '';

  ngOnInit(): void {
    this.refresh();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['items']) this.refresh();
  }

  private refresh(): void {
    this.gaugeItems = (this.items ?? [])
      .filter((item) => Number.isFinite(item.betterThanPct))
      .slice(0, 4)
      .map((item) => ({
        name: item.label.replace(' / semana', ''),
        value: Math.max(0, Math.min(100, Math.round(item.betterThanPct))),
        tone: item.tone,
      }));

    this.chartKey = this.gaugeItems.map((item) => `${item.name}:${item.value}`).join('|');
    this.chartOptions = this.gaugeItems.length
      ? buildPercentileGaugesOptions(this.gaugeItems)
      : {};
  }
}
