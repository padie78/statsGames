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
  buildPeerBenchmarkScatterOptions,
  buildPeerScoreBarOptions,
  type PeerBenchmarkPoint,
} from '../../../core/charts/echart-theme.util';

export type { PeerBenchmarkPoint };

@Component({
  standalone: true,
  selector: 'sg-peer-benchmark-panel',
  encapsulation: ViewEncapsulation.None,
  imports: [NgxEchartsDirective],
  template: `
    <section class="sg-peer-bench u-surface-card u-p-5" [attr.aria-label]="title">
      <header class="sg-peer-bench__header">
        <div>
          <p class="sg-peer-bench__eyebrow">Gráficos vs peers</p>
          <h3 class="sg-peer-bench__title">{{ title }}</h3>
          @if (subtitle) {
            <p class="sg-peer-bench__subtitle u-m-0">{{ subtitle }}</p>
          }
        </div>
        @if (sampleLabel) {
          <span class="sg-peer-bench__sample">{{ sampleLabel }}</span>
        }
      </header>

      @if (!peers.length) {
        <p class="sg-trend-chart__empty u-m-0">Sin peers reales para comparar esta semana.</p>
      } @else {
        <div class="sg-peer-bench__grid">
          <div class="sg-peer-bench__chart">
            <h4 class="sg-peer-bench__chart-title">Mapa WR × KDA</h4>
            <p class="sg-peer-bench__chart-desc u-m-0">
              Eje X = win rate, eje Y = KDA. Cada punto es un peer real; el tamaño sigue el score. Oro = vos.
            </p>
            <div
              class="sg-peer-bench__canvas"
              echarts
              [options]="scatterOptions"
              [autoResize]="true"
            ></div>
          </div>
          <div class="sg-peer-bench__chart">
            <h4 class="sg-peer-bench__chart-title">Ranking de score</h4>
            <p class="sg-peer-bench__chart-desc u-m-0">
              Barras del top de la muestra por score justo (mismo criterio que la tabla).
            </p>
            <div
              class="sg-peer-bench__canvas sg-peer-bench__canvas--bars"
              echarts
              [options]="barOptions"
              [autoResize]="true"
            ></div>
          </div>
        </div>
      }
    </section>
  `,
})
export class PeerBenchmarkPanelComponent implements OnInit, OnChanges {
  @Input() title = 'Benchmarking vs otros usuarios';
  @Input() subtitle = 'Tu posición relativa en la muestra semanal real.';
  @Input() sampleLabel = '';
  @Input() peers: PeerBenchmarkPoint[] = [];

  scatterOptions: EChartsOption = {};
  barOptions: EChartsOption = {};

  ngOnInit(): void {
    this.refresh();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['peers']) this.refresh();
  }

  private refresh(): void {
    this.scatterOptions = buildPeerBenchmarkScatterOptions(this.peers);
    this.barOptions = buildPeerScoreBarOptions(this.peers, 12);
  }
}
