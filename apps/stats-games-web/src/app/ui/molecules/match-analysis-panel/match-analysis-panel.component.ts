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
  buildMatchComparisonChartOptions,
  buildMatchRadarOptions,
  buildTrendChartOptions,
} from '../../../core/charts/echart-theme.util';
import type { MatchAnalysisReport } from '../../../utils/match-analysis.util';
import { AiInsightCardComponent } from '../ai-insight-card/ai-insight-card.component';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';
import { StatValueComponent } from '../../atoms/stat-value/stat-value.component';

@Component({
  standalone: true,
  selector: 'sg-match-analysis-panel',
  encapsulation: ViewEncapsulation.None,
  imports: [
    NgxEchartsDirective,
    NeonBadgeComponent,
    StatValueComponent,
    AiInsightCardComponent,
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

      <div class="sg-match-analysis__charts">
        <section class="sg-match-analysis__chart u-surface-card u-p-4">
          <header class="sg-trend-chart__header">
            <h3 class="sg-trend-chart__title">Perfil de la partida</h3>
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
            <h3 class="sg-trend-chart__title">Kills · partidas recientes</h3>
          </header>
          @if (report.recentKillsTrend.length) {
            <div
              class="sg-trend-chart__canvas"
              echarts
              [options]="killsTrendChartOptions"
              [autoResize]="true"
            ></div>
          } @else {
            <p class="sg-trend-chart__empty">Sin historial reciente.</p>
          }
        </section>

        @if (report.comparisonRows.length) {
          <section class="sg-match-analysis__chart u-surface-card u-p-4 sg-match-analysis__chart--wide">
            <header class="sg-trend-chart__header">
              <h3 class="sg-trend-chart__title">Esta partida vs tu promedio reciente</h3>
            </header>
            <div
              class="sg-trend-chart__canvas"
              echarts
              [options]="comparisonChartOptions"
              [autoResize]="true"
            ></div>
          </section>
        }
      </div>

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

  get killsTrendChartOptions(): EChartsOption {
    if (!this.report?.recentKillsTrend?.length) return {};
    return buildTrendChartOptions(this.report.recentKillsTrend, {
      variant: 'bar',
      color: '#f5d075',
      yAxisName: 'Kills',
    });
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
}
