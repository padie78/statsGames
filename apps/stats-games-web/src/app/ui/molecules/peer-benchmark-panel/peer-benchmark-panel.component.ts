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
  type PeerBenchmarkPoint,
} from '../../../core/charts/echart-theme.util';

export type { PeerBenchmarkPoint };

export type PeerBenchmarkVisualMode = 'scatter' | 'rank' | 'both';

interface ScoreRankRow {
  rank: number;
  gamerTag: string;
  score: number;
  isYou: boolean;
  pct: number;
}

@Component({
  standalone: true,
  selector: 'sg-peer-benchmark-panel',
  encapsulation: ViewEncapsulation.None,
  imports: [NgxEchartsDirective],
  template: `
    <section class="sg-peer-bench u-surface-card u-p-5" [attr.aria-label]="title">
      <header class="sg-peer-bench__header">
        <div class="sg-peer-bench__heading">
          <p class="sg-peer-bench__eyebrow">Gráficos vs peers</p>
          <h3 class="sg-peer-bench__title">{{ title }}</h3>
          @if (subtitle) {
            <p class="sg-peer-bench__subtitle">{{ subtitle }}</p>
          }
        </div>
        @if (sampleLabel) {
          <span class="sg-peer-bench__sample">{{ sampleLabel }}</span>
        }
      </header>

      @if (!peers.length) {
        <p class="sg-trend-chart__empty u-m-0">Sin peers reales para comparar esta semana.</p>
      } @else {
        <div
          class="sg-peer-bench__grid"
          [class.sg-peer-bench__grid--single]="visualMode !== 'both'"
        >
          @if (visualMode === 'scatter' || visualMode === 'both') {
            <div class="sg-peer-bench__chart">
              @if (visualMode === 'both') {
                <h4 class="sg-peer-bench__chart-title">Mapa WR × KDA</h4>
                <p class="sg-peer-bench__chart-desc u-m-0">
                  Eje X = win rate, eje Y = KDA. Cada punto es un peer real; el tamaño sigue el score. Oro = vos.
                </p>
              }
              <div
                class="sg-peer-bench__canvas"
                echarts
                [options]="scatterOptions"
                [autoResize]="true"
              ></div>
            </div>
          }

          @if (visualMode === 'rank' || visualMode === 'both') {
            <div class="sg-peer-bench__chart">
              <h4 class="sg-peer-bench__chart-title">Ranking de score</h4>
              <p class="sg-peer-bench__chart-desc u-m-0">
                Top de la muestra por score justo. Barra más larga = mejor score. Fila oro = vos.
              </p>
              <ol class="sg-peer-bench__rank" aria-label="Ranking de score">
                @for (row of scoreRows; track row.rank + row.gamerTag) {
                  <li
                    class="sg-peer-bench__rank-row"
                    [class.sg-peer-bench__rank-row--you]="row.isYou"
                  >
                    <span class="sg-peer-bench__rank-pos">#{{ row.rank }}</span>
                    <div class="sg-peer-bench__rank-main">
                      <div class="sg-peer-bench__rank-head">
                        <span class="sg-peer-bench__rank-name">
                          {{ row.gamerTag }}
                          @if (row.isYou) {
                            <em>Vos</em>
                          }
                        </span>
                        <strong class="sg-peer-bench__rank-score">{{ row.score }}</strong>
                      </div>
                      <div class="sg-peer-bench__rank-track" aria-hidden="true">
                        <span
                          class="sg-peer-bench__rank-fill"
                          [style.width.%]="row.pct"
                        ></span>
                      </div>
                    </div>
                  </li>
                }
              </ol>
            </div>
          }
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
  /** Un solo visual profundo por defecto (scatter); `both` solo si hace falta. */
  @Input() visualMode: PeerBenchmarkVisualMode = 'scatter';

  scatterOptions: EChartsOption = {};
  scoreRows: ScoreRankRow[] = [];

  ngOnInit(): void {
    this.refresh();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['peers'] || changes['visualMode']) this.refresh();
  }

  private refresh(): void {
    const peers = this.peers ?? [];
    this.scatterOptions = buildPeerBenchmarkScatterOptions(peers);

    const sorted = [...peers].sort((a, b) => b.score - a.score).slice(0, 10);
    const maxScore = Math.max(...sorted.map((p) => p.score), 1);
    this.scoreRows = sorted.map((p, index) => ({
      rank: index + 1,
      gamerTag: p.gamerTag,
      score: Math.round(p.score),
      isYou: Boolean(p.isYou),
      pct: Math.max(8, Math.round((p.score / maxScore) * 100)),
    }));
  }
}
