import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import {
  buildDualTrendChartOptions,
  buildYouVsBenchmarkChartOptions,
} from '../../../core/charts/echart-theme.util';
import type { CommunityRankTableView } from '../../../data/community-mock.data';
import type { WeeklyAiCoachSummary } from '../../../utils/weekly-ai-summary.util';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';
import { StatValueComponent } from '../../atoms/stat-value/stat-value.component';
import { CommunityRankTableComponent } from '../community-rank-table/community-rank-table.component';
import { TrendChartComponent } from '../trend-chart/trend-chart.component';

@Component({
  standalone: true,
  selector: 'sg-weekly-ai-coach-panel',
  encapsulation: ViewEncapsulation.None,
  imports: [
    NeonBadgeComponent,
    StatValueComponent,
    TrendChartComponent,
    CommunityRankTableComponent,
    NgxEchartsDirective,
  ],
  template: `
    <section class="sg-weekly-coach u-surface-card u-surface-card--ai u-p-5">
      <header class="sg-weekly-coach__header">
        <div>
          <div class="sg-weekly-coach__badges">
            <sg-neon-badge tone="purple">Análisis semanal</sg-neon-badge>
          </div>
          <h2 class="sg-weekly-coach__title">{{ summary.headline }}</h2>
          <p class="sg-weekly-coach__lead u-m-0">{{ summary.body }}</p>
        </div>
        <button type="button" class="u-btn u-btn--ai" (click)="ctaClick.emit()">
          {{ ctaLabel }}
        </button>
      </header>

      @if (summary.metricCards.length) {
        <div class="sg-weekly-coach__metrics">
          @for (card of summary.metricCards; track card.label) {
            <div class="sg-weekly-coach__metric">
              <sg-stat-value
                [label]="card.label"
                [value]="card.value"
                [accent]="metricAccent(card.tone)"
              />
              @if (card.hint) {
                <span class="sg-weekly-coach__metric-hint">{{ card.hint }}</span>
              }
            </div>
          }
        </div>
      }

      @if (summary.narrative.length) {
        <div class="sg-weekly-coach__narrative">
          @for (paragraph of summary.narrative; track paragraph) {
            <p class="sg-weekly-coach__paragraph">{{ paragraph }}</p>
          }
        </div>
      }

      <div class="sg-weekly-coach__columns">
        <article class="sg-weekly-coach__list-card">
          <h3 class="sg-weekly-coach__list-title sg-weekly-coach__list-title--pro">
            Lo que mejoraste
          </h3>
          <ul class="sg-weekly-coach__list">
            @for (item of summary.strengths; track item) {
              <li>{{ item }}</li>
            } @empty {
              <li class="u-hint">Todavía no hay fortalezas claras esta semana.</li>
            }
          </ul>
        </article>

        <article class="sg-weekly-coach__list-card">
          <h3 class="sg-weekly-coach__list-title sg-weekly-coach__list-title--con">
            A trabajar
          </h3>
          <ul class="sg-weekly-coach__list">
            @for (item of summary.improvements; track item) {
              <li>{{ item }}</li>
            } @empty {
              <li class="u-hint">Sin focos críticos — sostener hábitos.</li>
            }
          </ul>
        </article>

        <article class="sg-weekly-coach__list-card">
          <h3 class="sg-weekly-coach__list-title sg-weekly-coach__list-title--warn">
            Qué empeoró / se enfrió
          </h3>
          <ul class="sg-weekly-coach__list">
            @for (item of summary.regressions; track item) {
              <li>{{ item }}</li>
            } @empty {
              <li class="u-hint">Sin regresiones mid-week detectadas.</li>
            }
          </ul>
        </article>
      </div>

      @if (summary.halfWeekRows.length) {
        <section class="sg-weekly-coach__deltas">
          <h3 class="sg-weekly-coach__section-title">1ª mitad vs 2ª mitad de la semana</h3>
          <div class="sg-weekly-coach__delta-grid">
            @for (row of summary.halfWeekRows; track row.label) {
              <article
                class="sg-weekly-coach__delta"
                [class.sg-weekly-coach__delta--up]="row.direction === 'up'"
                [class.sg-weekly-coach__delta--down]="row.direction === 'down'"
              >
                <p class="sg-weekly-coach__delta-label u-m-0">{{ row.label }}</p>
                <p class="sg-weekly-coach__delta-values u-m-0">
                  {{ row.earlyValue }} → {{ row.lateValue }}
                  <strong>{{ row.deltaLabel }}</strong>
                </p>
                <p class="sg-weekly-coach__delta-note u-m-0">{{ row.note }}</p>
              </article>
            }
          </div>
        </section>
      }

      <div class="sg-weekly-coach__charts">
        @if (summary.killsTrend.length) {
          <div class="sg-weekly-coach__chart">
            <header class="sg-trend-chart__header">
              <h3 class="sg-trend-chart__title">Forma · Kills por partida</h3>
              <p class="sg-trend-chart__subtitle u-m-0">Cómo venís frageando en la semana</p>
            </header>
            <div
              class="sg-trend-chart__canvas"
              echarts
              [options]="killsKdChartOptions"
              [autoResize]="true"
            ></div>
          </div>
        }

        @if (summary.resultTrend.length) {
          <sg-trend-chart
            class="sg-weekly-coach__chart"
            title="Forma · Resultado (1 = win, 0 = loss)"
            unit="W/L"
            [points]="summary.resultTrend"
            variant="area"
            color="#f0d060"
            areaColor="rgba(240, 208, 96, 0.18)"
          />
        }

        @if (summary.communityRows.length) {
          <div class="sg-weekly-coach__chart sg-weekly-coach__chart--wide">
            <header class="sg-trend-chart__header">
              <h3 class="sg-trend-chart__title">Vos vs comunidad (semana)</h3>
              <p class="sg-trend-chart__subtitle u-m-0">
                Comparativa de WR, {{ summary.kdLabel }}, kills y volumen
              </p>
            </header>
            <div
              class="sg-trend-chart__canvas"
              echarts
              [options]="communityChartOptions"
              [autoResize]="true"
            ></div>
          </div>
        }
      </div>

      @if (communityRank; as rank) {
        <sg-community-rank-table
          variant="deep"
          title="Comparación con la muestra semanal"
          subtitle="Solo jugadores reales sincronizados esta semana en la misma plataforma."
          sampleLabel="Leaderboard semanal"
          [deepLink]="null"
          [rows]="rank.rows"
          [yourRank]="rank.yourRank"
          [totalPlayers]="rank.totalPlayers"
          [platform]="rank.platform"
        />
      } @else {
        <aside class="sg-weekly-coach__empty-rank" role="status">
          <p class="sg-weekly-coach__empty-rank-title u-m-0">
            Ranking comunitario aún sin peers
          </p>
          <p class="sg-weekly-coach__empty-rank-body u-m-0">
            No hay otros jugadores reales en el leaderboard de esta semana para tu
            plataforma. La tabla no inventa rivales: aparece cuando haya datos
            sincronizados.
          </p>
        </aside>
      }

      @if (summary.focusNext) {
        <aside class="sg-weekly-coach__focus">
          <p class="sg-weekly-coach__focus-label u-m-0">Próximo foco</p>
          <p class="sg-weekly-coach__focus-body u-m-0">{{ summary.focusNext }}</p>
        </aside>
      }
    </section>
  `,
})
export class WeeklyAiCoachPanelComponent {
  @Input({ required: true }) summary!: WeeklyAiCoachSummary;
  @Input() communityRank: CommunityRankTableView | null = null;
  @Input() ctaLabel = 'Ver análisis semanal';
  @Output() readonly ctaClick = new EventEmitter<void>();

  get killsKdChartOptions(): EChartsOption {
    if (!this.summary?.killsTrend?.length) return {};
    return buildDualTrendChartOptions(
      this.summary.killsTrend,
      this.summary.kdTrend.length
        ? this.summary.kdTrend
        : this.summary.killsTrend.map((p) => ({ ...p, value: 0 })),
      { primary: 'Kills', secondary: this.summary.kdLabel || 'K/D' },
    );
  }

  get communityChartOptions(): EChartsOption {
    if (!this.summary?.communityRows?.length) return {};
    return buildYouVsBenchmarkChartOptions(this.summary.communityRows, {
      you: 'Vos',
      benchmark: 'Comunidad',
    });
  }

  metricAccent(tone: string): 'lime' | 'cyan' | 'default' {
    if (tone === 'danger' || tone === 'muted') return 'default';
    // lime / cyan / gold → acento oro unificado
    return 'lime';
  }
}
