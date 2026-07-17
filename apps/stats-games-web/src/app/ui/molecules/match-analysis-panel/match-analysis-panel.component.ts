import {
  Component,
  EventEmitter,
  Input,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import {
  buildDualTrendChartOptions,
  buildEconomyTimelineChartOptions,
  buildMatchComparisonChartOptions,
  buildMatchRadarOptions,
  buildYouVsBenchmarkChartOptions,
} from '../../../core/charts/echart-theme.util';
import type { MatchAnalysisReport } from '../../../utils/match-analysis.util';
import { AiInsightCardComponent } from '../ai-insight-card/ai-insight-card.component';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';
import { StatValueComponent } from '../../atoms/stat-value/stat-value.component';
import { PercentileGaugesComponent } from '../percentile-gauges/percentile-gauges.component';

@Component({
  standalone: true,
  selector: 'sg-match-analysis-panel',
  encapsulation: ViewEncapsulation.None,
  imports: [
    NgxEchartsDirective,
    NeonBadgeComponent,
    StatValueComponent,
    AiInsightCardComponent,
    PercentileGaugesComponent,
  ],
  template: `
    <div class="sg-match-analysis">
      <section class="sg-match-analysis__hero u-surface-card u-surface-card--ai u-p-5">
        <header class="sg-match-analysis__hero-header">
          <div class="sg-match-analysis__score" [class]="'sg-match-analysis__score--' + report.verdict">
            <span class="sg-match-analysis__grade">{{ report.gradeLabel }}</span>
            <span class="sg-match-analysis__score-label">{{ report.performanceScore }}/100</span>
          </div>
          <div class="sg-match-analysis__hero-copy">
            <h2 class="sg-match-analysis__title">{{ report.headline }}</h2>
            <p class="sg-match-analysis__summary u-m-0">{{ report.summary }}</p>
          </div>
          <sg-neon-badge tone="purple">AI Coach</sg-neon-badge>
        </header>

        @if (report.isPreview) {
          <p class="sg-match-analysis__preview u-m-0">
            Preview enriquecido local — el reporte Bedrock reemplaza esta vista cuando está listo.
          </p>
        }

        <div class="sg-match-analysis__metrics">
          @for (metric of report.keyMetrics; track metric.label) {
            <div class="sg-match-analysis__metric u-surface-card u-p-3">
              <sg-stat-value
                [label]="metric.label"
                [value]="metric.value"
                [accent]="metric.accent ?? 'default'"
              />
              @if (metric.hint) {
                <span class="sg-match-analysis__metric-hint">{{ metric.hint }}</span>
              }
            </div>
          }
        </div>
      </section>

      <section class="sg-match-analysis__resilience u-surface-card u-p-5">
        <header class="sg-match-analysis__resilience-header">
          <div>
            <h3 class="sg-match-analysis__section-title u-m-0">Scorecard de resiliencia</h3>
            <p class="sg-match-analysis__resilience-sub u-m-0">
              Perfil comportamental estimado desde stats de fin de partida y tu historial reciente.
            </p>
          </div>
          <div class="sg-match-analysis__resilience-overall">
            <span class="sg-match-analysis__resilience-grade">{{
              report.resilienceScorecard.gradeLabel
            }}</span>
            <span class="sg-match-analysis__resilience-score"
              >{{ report.resilienceScorecard.overall }}/100</span
            >
          </div>
        </header>

        <div class="sg-match-analysis__resilience-grid">
          @for (dim of report.resilienceScorecard.dimensions; track dim.key) {
            <article class="sg-match-analysis__resilience-card">
              <div class="sg-match-analysis__resilience-card-top">
                <span class="sg-match-analysis__resilience-card-label">{{ dim.label }}</span>
                <strong class="sg-match-analysis__resilience-card-value">{{ dim.score }}</strong>
              </div>
              <div
                class="sg-match-analysis__resilience-bar"
                role="meter"
                [attr.aria-valuenow]="dim.score"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <span
                  class="sg-match-analysis__resilience-bar-fill"
                  [style.width.%]="dim.score"
                  [class.sg-match-analysis__resilience-bar-fill--high]="dim.score >= 72"
                  [class.sg-match-analysis__resilience-bar-fill--mid]="dim.score >= 50 && dim.score < 72"
                  [class.sg-match-analysis__resilience-bar-fill--low]="dim.score < 50"
                ></span>
              </div>
              <p class="sg-match-analysis__resilience-hint u-m-0">{{ dim.hint }}</p>
            </article>
          }
        </div>
      </section>

      @if (report.structuredSections.length) {
        <div class="sg-match-analysis__structured">
          @for (section of report.structuredSections; track section.title) {
            <section class="u-surface-card u-p-5">
              <h3 class="sg-match-analysis__section-title">{{ section.title }}</h3>
              <ul class="sg-match-analysis__list">
                @for (item of section.items; track item) {
                  <li>{{ item }}</li>
                }
              </ul>
            </section>
          }
        </div>
      } @else {
        <section class="sg-match-analysis__narrative u-surface-card u-p-5">
          <h3 class="sg-match-analysis__section-title">Análisis detallado</h3>
          @for (paragraph of report.narrative; track paragraph) {
            <p class="sg-match-analysis__paragraph">{{ paragraph }}</p>
          } @empty {
            <p class="sg-match-analysis__paragraph u-hint u-m-0">
              Sin narrativa disponible para esta partida todavía.
            </p>
          }
        </section>
      }

      <div class="sg-match-analysis__charts">
        <section class="sg-match-analysis__chart u-surface-card u-p-4">
          <header class="sg-trend-chart__header">
            <h3 class="sg-trend-chart__title">Perfil de la partida</h3>
            <p class="sg-trend-chart__subtitle u-m-0">Radar mecánico según el juego</p>
          </header>
          @if (report.radarAxes.length) {
            <div
              class="sg-trend-chart__canvas sg-trend-chart__canvas--radar"
              echarts
              [options]="radarChartOptions"
              [autoResize]="true"
            ></div>
          } @else {
            <p class="sg-trend-chart__empty">Sin datos de perfil.</p>
          }
        </section>

        <section class="sg-match-analysis__chart u-surface-card u-p-4">
          <header class="sg-trend-chart__header">
            <h3 class="sg-trend-chart__title">Tendencia propia</h3>
            <p class="sg-trend-chart__subtitle u-m-0">Kills y K/D en partidas recientes</p>
          </header>
          @if (report.recentKillsTrend.length) {
            <div
              class="sg-trend-chart__canvas"
              echarts
              [options]="dualTrendChartOptions"
              [autoResize]="true"
            ></div>
          } @else {
            <p class="sg-trend-chart__empty">Sin historial reciente.</p>
          }
        </section>

        @if (report.economyTimeline; as economy) {
          <section class="sg-match-analysis__chart u-surface-card u-p-4 sg-match-analysis__chart--wide">
            <header class="sg-trend-chart__header">
              <div>
                <h3 class="sg-trend-chart__title">Timeline económico LoL</h3>
                <p class="sg-trend-chart__subtitle u-m-0">
                  CS y gold acumulados
                  @if (economy.estimated) {
                    · estimado desde totales de fin de partida
                  }
                </p>
              </div>
              <div class="sg-match-analysis__economy-rates">
                @if (economy.csPerMin != null) {
                  <span>CS/min {{ economy.csPerMin }}</span>
                }
                @if (economy.goldPerMin != null) {
                  <span>Gold/min {{ economy.goldPerMin }}</span>
                }
              </div>
            </header>
            <div
              class="sg-trend-chart__canvas"
              echarts
              [options]="economyTimelineChartOptions"
              [autoResize]="true"
            ></div>
          </section>
        }

        @if (report.comparisonRows.length) {
          <section class="sg-match-analysis__chart u-surface-card u-p-4 sg-match-analysis__chart--wide">
            <header class="sg-trend-chart__header">
              <h3 class="sg-trend-chart__title">Esta partida vs tus partidas recientes</h3>
              <p class="sg-trend-chart__subtitle u-m-0">
                Comparación contra tu promedio histórico inmediato
              </p>
            </header>
            <div
              class="sg-trend-chart__canvas"
              echarts
              [options]="comparisonChartOptions"
              [autoResize]="true"
            ></div>
          </section>
        }

        @if (report.communityBenchmarkRows.length) {
          <section class="sg-match-analysis__chart u-surface-card u-p-4 sg-match-analysis__chart--wide">
            <header class="sg-trend-chart__header">
              <h3 class="sg-trend-chart__title">Esta partida vs comunidad</h3>
              <p class="sg-trend-chart__subtitle u-m-0">
                Benchmark semanal de otros jugadores de la plataforma
              </p>
            </header>
            <div
              class="sg-trend-chart__canvas"
              echarts
              [options]="communityChartOptions"
              [autoResize]="true"
            ></div>
          </section>
        }
      </div>

      @if (report.communityPercentiles.length) {
        <sg-percentile-gauges
          title="Percentiles vs comunidad"
          subtitle="Estimación de qué % de la muestra superás con el rendimiento de esta partida."
          [items]="report.communityPercentiles"
        />
      }

      <div class="sg-match-analysis__pros-cons">
        <section class="sg-match-analysis__pros u-surface-card u-p-5">
          <h3 class="sg-match-analysis__section-title sg-match-analysis__section-title--pro">Pros</h3>
          <ul class="sg-match-analysis__list sg-match-analysis__list--pro">
            @for (item of report.pros; track item) {
              <li>{{ item }}</li>
            }
          </ul>
        </section>

        <section class="sg-match-analysis__cons u-surface-card u-p-5">
          <h3 class="sg-match-analysis__section-title sg-match-analysis__section-title--con">Contras</h3>
          <ul class="sg-match-analysis__list sg-match-analysis__list--con">
            @for (item of report.cons; track item) {
              <li>{{ item }}</li>
            }
          </ul>
        </section>
      </div>

      <section class="sg-match-analysis__plan u-surface-card u-p-5">
        <h3 class="sg-match-analysis__section-title">Plan de acción</h3>
        <ol class="sg-match-analysis__plan-list">
          @for (step of report.actionPlan; track step; let i = $index) {
            <li>
              <span class="sg-match-analysis__plan-step">{{ i + 1 }}</span>
              <span>{{ step }}</span>
            </li>
          }
        </ol>
      </section>

      <sg-ai-insight-card
        headline="Próximo foco"
        [body]="report.focusNext"
        [ctaLabel]="ctaLabel"
        (ctaClick)="ctaClick.emit()"
      />
    </div>
  `,
})
export class MatchAnalysisPanelComponent {
  @Input({ required: true }) report!: MatchAnalysisReport;
  @Input() ctaLabel = 'Ver todas las partidas';
  @Output() readonly ctaClick = new EventEmitter<void>();

  get radarChartOptions(): EChartsOption {
    if (!this.report?.radarAxes?.length) return {};
    return buildMatchRadarOptions(
      this.report.radarAxes.map((axis) => ({ name: axis.name, value: axis.value })),
      'Esta partida',
    );
  }

  get dualTrendChartOptions(): EChartsOption {
    if (!this.report?.recentKillsTrend?.length) return {};
    return buildDualTrendChartOptions(
      this.report.recentKillsTrend,
      this.report.recentKdTrend.length
        ? this.report.recentKdTrend
        : this.report.recentKillsTrend.map((point) => ({ ...point, value: 0 })),
      { primary: 'Kills', secondary: 'K/D' },
    );
  }

  get economyTimelineChartOptions(): EChartsOption {
    const economy = this.report?.economyTimeline;
    if (!economy) return {};
    return buildEconomyTimelineChartOptions(economy.csTrend, economy.goldTrend);
  }

  get comparisonChartOptions(): EChartsOption {
    if (!this.report?.comparisonRows?.length) return {};
    return buildMatchComparisonChartOptions(
      this.report.comparisonRows.map((row) => ({
        label: row.label,
        matchValue: row.matchValue,
        averageValue: row.averageValue,
      })),
    );
  }

  get communityChartOptions(): EChartsOption {
    if (!this.report?.communityBenchmarkRows?.length) return {};
    return buildYouVsBenchmarkChartOptions(
      this.report.communityBenchmarkRows.map((row) => ({
        label: row.label,
        you: row.matchValue,
        benchmark: row.averageValue,
      })),
      { you: 'Esta partida', benchmark: 'Comunidad' },
    );
  }
}
