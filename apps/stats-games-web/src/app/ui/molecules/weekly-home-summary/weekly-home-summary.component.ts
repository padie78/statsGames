import {
  Component,
  EventEmitter,
  Input,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import {
  buildDualTrendChartOptions,
  buildYouVsBenchmarkChartOptions,
} from '../../../core/charts/echart-theme.util';
import type { WeeklyAiCoachSummary } from '../../../utils/weekly-ai-summary.util';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

interface HomeWeekChip {
  label: string;
  text: string;
  tone: 'lime' | 'gold';
}

/**
 * Resumen hero del análisis semanal para Inicio del portal jugador.
 * Compacto: headline, señales, plan de acción y gráficos secundarios.
 */
@Component({
  standalone: true,
  selector: 'sg-weekly-home-summary',
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink, NeonBadgeComponent, NgxEchartsDirective],
  template: `
    <article class="sg-home-week" aria-label="Análisis semanal">
      <header class="sg-home-week__header">
        <div class="sg-home-week__header-top">
          <div class="sg-home-week__badges">
            <sg-neon-badge tone="purple">Análisis semanal</sg-neon-badge>
            <span class="sg-home-week__meta">
              {{ summary.winCount }}V · {{ summary.lossCount }}D ·
              {{ summary.matchCount }} partidas
            </span>
          </div>
          <a routerLink="/tabs/ai-coach" class="sg-home-week__link">Ver completo →</a>
        </div>
        <h2 class="sg-home-week__title">{{ summary.headline }}</h2>
        <p class="sg-home-week__lead u-m-0">{{ summary.body }}</p>
        @if (summary.narrative[0]) {
          <p class="sg-home-week__narrative u-m-0">{{ summary.narrative[0] }}</p>
        }
      </header>

      <div class="sg-home-week__body">
        <div class="sg-home-week__insight">
          @if (chips.length) {
            <div class="sg-home-week__chips">
              @for (chip of chips; track chip.label + chip.text) {
                <div class="sg-home-week__chip" [attr.data-tone]="chip.tone">
                  <span class="sg-home-week__chip-label">{{ chip.label }}</span>
                  <p class="sg-home-week__chip-text u-m-0">{{ chip.text }}</p>
                </div>
              }
            </div>
          }

          @if (practiceTips.length || avoidTips.length) {
            <div class="sg-home-week__plan">
              @if (practiceTips.length) {
                <section class="sg-home-week__plan-col">
                  <h3 class="sg-home-week__plan-title sg-home-week__plan-title--do">
                    Practicar hoy
                  </h3>
                  <ul class="sg-home-week__checklist">
                    @for (tip of practiceTips; track tip) {
                      <li>{{ tip }}</li>
                    }
                  </ul>
                </section>
              }
              @if (avoidTips.length) {
                <section class="sg-home-week__plan-col">
                  <h3 class="sg-home-week__plan-title sg-home-week__plan-title--dont">
                    Evitar esta semana
                  </h3>
                  <ul class="sg-home-week__checklist sg-home-week__checklist--dont">
                    @for (tip of avoidTips; track tip) {
                      <li>{{ tip }}</li>
                    }
                  </ul>
                </section>
              }
            </div>
          }
        </div>

        @if (hasCharts) {
          <aside class="sg-home-week__charts" aria-label="Gráficos de la semana">
            @if (summary.killsTrend.length) {
              <div class="sg-home-week__chart">
                <p class="sg-home-week__chart-label u-m-0">Forma · Kills y {{ kdLabel }}</p>
                <div
                  class="sg-home-week__chart-canvas"
                  echarts
                  [options]="formChartOptions"
                  [autoResize]="true"
                ></div>
              </div>
            }
            @if (summary.communityRows.length) {
              <div class="sg-home-week__chart">
                <p class="sg-home-week__chart-label u-m-0">Vos vs comunidad</p>
                <div
                  class="sg-home-week__chart-canvas"
                  echarts
                  [options]="communityChartOptions"
                  [autoResize]="true"
                ></div>
              </div>
            }
          </aside>
        }
      </div>

      <footer class="sg-home-week__footer">
        <button
          type="button"
          class="u-btn u-btn--gold u-btn--sm"
          (click)="primaryClick.emit()"
        >
          {{ ctaLabel }}
        </button>
        <a routerLink="/tabs/analytics" class="u-btn u-btn--ghost-gold u-btn--sm">
          Ver Evolución →
        </a>
      </footer>
    </article>
  `,
})
export class WeeklyHomeSummaryComponent {
  @Input({ required: true }) summary!: WeeklyAiCoachSummary;
  @Input() kdLabel = 'K/D';
  @Input() ctaLabel = 'Ver análisis semanal';
  @Output() readonly primaryClick = new EventEmitter<void>();

  get chips(): HomeWeekChip[] {
    const items: HomeWeekChip[] = [];
    if (this.summary?.strengths[0]) {
      items.push({ label: 'Bien', text: this.summary.strengths[0], tone: 'lime' });
    }
    if (this.summary?.focusNext) {
      items.push({ label: 'Foco', text: this.summary.focusNext, tone: 'gold' });
    }
    return items;
  }

  get practiceTips(): string[] {
    return this.summary?.improvements.slice(0, 2) ?? [];
  }

  get avoidTips(): string[] {
    return this.summary?.regressions.slice(0, 2) ?? [];
  }

  get hasCharts(): boolean {
    return !!this.summary?.killsTrend.length || !!this.summary?.communityRows.length;
  }

  get formChartOptions(): EChartsOption {
    const summary = this.summary;
    if (!summary?.killsTrend.length) return {};
    const base = buildDualTrendChartOptions(
      summary.killsTrend,
      summary.kdTrend.length
        ? summary.kdTrend
        : summary.killsTrend.map((point) => ({ ...point, value: 0 })),
      { primary: 'Kills', secondary: this.kdLabel || summary.kdLabel || 'K/D' },
    );
    return this.withGoldSeries(base, 'dual');
  }

  get communityChartOptions(): EChartsOption {
    const rows = this.summary?.communityRows ?? [];
    if (!rows.length) return {};
    const base = buildYouVsBenchmarkChartOptions(rows, {
      you: 'Vos',
      benchmark: 'Comunidad',
    });
    return this.withGoldSeries(base, 'bars');
  }

  /** Paleta oro para charts del resumen de Inicio. */
  private withGoldSeries(options: EChartsOption, mode: 'dual' | 'bars'): EChartsOption {
    const gold = '#f0d060';
    const goldDeep = '#c89b3c';
    const goldSoft = 'rgba(240, 208, 96, 0.22)';
    const series = options.series;
    if (!Array.isArray(series)) return options;

    if (mode === 'dual') {
      const [bars, line] = series;
      if (bars && typeof bars === 'object') {
        (bars as { itemStyle?: Record<string, unknown> }).itemStyle = {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: gold },
              { offset: 1, color: goldSoft },
            ],
          },
          borderRadius: [6, 6, 2, 2],
        };
      }
      if (line && typeof line === 'object') {
        Object.assign(line as object, {
          lineStyle: { width: 3, color: goldDeep },
          itemStyle: { color: goldDeep, borderColor: '#0a1020', borderWidth: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: goldSoft },
                { offset: 1, color: 'rgba(10, 16, 32, 0)' },
              ],
            },
          },
        });
      }
    } else {
      const [you, bench] = series;
      if (you && typeof you === 'object') {
        (you as { itemStyle?: Record<string, unknown> }).itemStyle = {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: gold },
              { offset: 1, color: goldSoft },
            ],
          },
          borderRadius: [7, 7, 2, 2],
        };
      }
      if (bench && typeof bench === 'object') {
        (bench as { itemStyle?: Record<string, unknown> }).itemStyle = {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: goldDeep },
              { offset: 1, color: 'rgba(200, 155, 60, 0.35)' },
            ],
          },
          borderRadius: [7, 7, 2, 2],
        };
      }
    }

    return { ...options, series };
  }
}
