import { DOCUMENT } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { lolMatchesBannerSplashUrl } from '../../../core/game/lol-ddragon.util';
import { valorantMatchesBannerSplashUrl } from '../../../core/game/valorant-assets.util';
import {
  OBJECTIVE_DOMAIN_LABELS,
  OBJECTIVE_DOMAIN_ORDER,
  OBJECTIVE_METRIC_TYPES,
  type ObjectiveMetricDomain,
} from '@stats-games/common';
import {
  ObjectivesService,
  currentIsoWeekPeriodId,
  currentMonthPeriodId,
  type ObjectiveEvolutionView,
  type ObjectiveMetricTypeView,
  type TargetProgramHistoryItemView,
  type TargetProgramView,
} from '../../../services/objectives.service';
import {
  isoInAnalysisRange,
  todayPeriodId,
  type AnalysisRangeId,
} from '../../../core/analysis/analysis-range';
import {
  StatsComparisonChartComponent,
  type StatsComparisonRow,
} from '../stats-comparison-chart/stats-comparison-chart.component';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';
import { StatValueComponent } from '../../atoms/stat-value/stat-value.component';
import { extractGraphqlErrorMessage } from '../../../utils/graphql-error.util';
import { sgFadeSlideIn, sgModalIn } from '../../animations/sg-motion';

type ObjTab = 'builder' | 'reality' | 'compliance' | 'history';
type HistoryFilter = 'all' | 'in_progress' | 'fulfilled' | 'not_fulfilled';
type ModalKind = 'program' | 'execution' | null;
type ComplianceFilter = 'all' | 'aligned' | 'above' | 'critical' | 'pending';
type ComplianceStatus = 'aligned' | 'above' | 'critical' | 'pending';
type DeltaTone = 'ok' | 'warn' | 'danger' | 'muted';

/** Fila de cumplimiento lista para render: plan, real, desvío y barra. */
interface ComplianceRowVm {
  key: string;
  metricTypeId: string;
  metricLabel: string;
  domainLabel: string;
  goalLabel: string;
  sourceLabel: string;
  periodId: string;
  unit: string;
  planLabel: string;
  actualLabel: string;
  pctLabel: string;
  compliancePct: number | null;
  /** Ancho de la barra: la meta (100%) queda en el 75% del track. */
  barPct: number;
  deltaLabel: string;
  deltaTone: DeltaTone;
  status: ComplianceStatus;
  statusLabel: string;
}

/** La meta (100%) se dibuja al 75% del track para dejar ver el excedente. */
const COMPLIANCE_GOAL_ANCHOR_PCT = 75;

function complianceBarWidth(pct: number | null): number {
  if (pct == null) return 0;
  const scaled = (pct / 100) * COMPLIANCE_GOAL_ANCHOR_PCT;
  return Math.max(2, Math.min(100, Math.round(scaled)));
}

function formatMetricValue(value: number, unit: string): string {
  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, '');
  return unit ? `${rounded} ${unit}` : rounded;
}

function formatDeltaValue(delta: number | null, unit: string): string {
  if (delta == null) return '—';
  const rounded = Math.round(delta * 100) / 100;
  if (rounded === 0) return unit ? `0 ${unit}` : '0';
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${formatMetricValue(rounded, unit)}`;
}

function deltaToneForStatus(status: ComplianceStatus): DeltaTone {
  if (status === 'aligned') return 'ok';
  if (status === 'above') return 'warn';
  if (status === 'critical') return 'danger';
  return 'muted';
}

/** Ordena críticas primero, luego sin dato, alineadas y excedidas. */
function complianceSortWeight(row: ComplianceRowVm): number {
  switch (row.status) {
    case 'critical':
      return 0;
    case 'pending':
      return 1;
    case 'aligned':
      return 2;
    default:
      return 3;
  }
}

interface DraftTargetRow {
  metricTypeId: string;
  periodId: string;
  plannedValue: number | null;
}

@Component({
  standalone: true,
  selector: 'sg-objectives-plan-panel',
  encapsulation: ViewEncapsulation.None,
  imports: [
    FormsModule,
    RouterLink,
    StatsComparisonChartComponent,
    NeonBadgeComponent,
    StatValueComponent,
  ],
  animations: [sgFadeSlideIn, sgModalIn],
  template: `
    <section class="sg-obj-panel" aria-labelledby="sg-obj-title">
      <header class="sg-obj-panel__head">
        <div>
          <p class="sg-obj-panel__eyebrow">Plan vs Realidad</p>
          <h2 id="sg-obj-title" class="sg-obj-panel__title">Programa de objetivos</h2>
          <p class="sg-obj-panel__desc u-m-0">
            Definí metas por métrica, cargá la ejecución y medí cumplimiento.
          </p>
        </div>
        <div class="sg-obj-panel__tabs" role="tablist" aria-label="Secciones del programa">
          <button
            type="button"
            role="tab"
            class="sg-obj-panel__tab"
            [class.sg-obj-panel__tab--active]="tab() === 'builder'"
            [attr.aria-selected]="tab() === 'builder'"
            (click)="openBuilder()"
          >
            Programa
          </button>
          <button
            type="button"
            role="tab"
            class="sg-obj-panel__tab"
            [class.sg-obj-panel__tab--active]="tab() === 'reality'"
            [attr.aria-selected]="tab() === 'reality'"
            (click)="tab.set('reality')"
          >
            Realidad
          </button>
          <button
            type="button"
            role="tab"
            class="sg-obj-panel__tab"
            [class.sg-obj-panel__tab--active]="tab() === 'compliance'"
            [attr.aria-selected]="tab() === 'compliance'"
            (click)="tab.set('compliance')"
          >
            Cumplimiento
          </button>
          <button
            type="button"
            role="tab"
            class="sg-obj-panel__tab"
            [class.sg-obj-panel__tab--active]="tab() === 'history'"
            [attr.aria-selected]="tab() === 'history'"
            (click)="openHistory()"
          >
            Historial
          </button>
        </div>
      </header>

      @if (error()) {
        <p class="u-error u-m-0">{{ error() }}</p>
      }

      @if (tab() === 'builder') {
        <div class="sg-obj-panel__body" role="tabpanel">
          @if (loading() && !program() && !activePrograms().length) {
            <p class="sg-obj-hint u-m-0">Cargando programas…</p>
          } @else if (program() || activePrograms().length) {
            <div class="sg-obj-program-stack">
              <div class="sg-obj-summary__section-head">
                <h4 class="sg-obj-summary__section-title">
                  Programas activos ({{ activePrograms().length || (program() ? 1 : 0) }})
                </h4>
                <button
                  type="button"
                  class="u-btn u-btn--gold"
                  (click)="openProgramModal('create')"
                >
                  Nuevo programa
                </button>
              </div>

              @if (activePrograms().length) {
                <ul class="sg-obj-active-list" role="listbox" aria-label="Programas activos">
                  @for (item of activePrograms(); track item.programId) {
                    <li>
                      <button
                        type="button"
                        class="sg-obj-active-chip"
                        role="option"
                        [class.sg-obj-active-chip--selected]="
                          program()?.programId === item.programId
                        "
                        [attr.aria-selected]="program()?.programId === item.programId"
                        (click)="selectActiveProgram(item)"
                      >
                        <span class="sg-obj-active-chip__title">{{ item.title }}</span>
                        <span class="sg-obj-active-chip__meta">
                          {{ item.cadence === 'monthly' ? 'Mensual' : 'Semanal' }}
                          · {{ item.targetCount }} metas
                          @if (item.globalCompliancePct != null) {
                            · {{ roundPct(item.globalCompliancePct) }}%
                          }
                        </span>
                      </button>
                    </li>
                  }
                </ul>
              }

              @if (program(); as p) {
              <article
                class="sg-match-panel sg-match-card sg-match-card--panel u-surface-card sg-obj-program-hero"
                [class.sg-match-card--victory]="programHeroOutcome() === 'win'"
                [class.sg-match-card--defeat]="programHeroOutcome() === 'loss'"
                [attr.data-status]="programHeroStatus()"
              >
                <div
                  class="sg-match-card__award"
                  [attr.data-outcome]="programHeroOutcome()"
                  [attr.aria-label]="programHeroStatusLabel()"
                >
                  <span class="sg-match-card__award-band">{{ programHeroStatusLabel() }}</span>
                </div>

                <div class="sg-match-panel__body">
                  <header class="sg-match-panel__head">
                    <div class="sg-match-panel__head-copy">
                      <p class="sg-match-panel__eyebrow">Programa seleccionado</p>
                      <h3 class="sg-match-panel__title">{{ p.title }}</h3>
                      <p class="sg-match-panel__summary">
                        {{ p.cadence === 'monthly' ? 'Cadencia mensual' : 'Cadencia semanal' }}
                        · desde {{ formatDate(p.startsAt) }}
                        · {{ programTargetCards().length }} metas
                      </p>
                    </div>

                    <div
                      class="sg-match-panel__score"
                      [attr.aria-label]="
                        'Cumplimiento ' +
                        (programCompliancePct() != null ? programCompliancePct() + '%' : 'sin dato')
                      "
                    >
                      <div class="sg-match-panel__score-part">
                        <span class="sg-match-panel__score-num">
                          {{
                            programCompliancePct() != null
                              ? programCompliancePct() + '%'
                              : '—'
                          }}
                        </span>
                        <span class="sg-match-panel__score-label">Cumpl.</span>
                      </div>
                    </div>
                  </header>

                  <ul class="sg-match-panel__strip" aria-label="Resumen del programa">
                    <li class="sg-match-panel__strip-item">
                      <span class="sg-match-panel__strip-value">{{ programPeriodLabel() }}</span>
                      <span class="sg-match-panel__strip-label">Período</span>
                    </li>
                    <li class="sg-match-panel__strip-item">
                      <span class="sg-match-panel__strip-value">{{ programTrackedCount() }}</span>
                      <span class="sg-match-panel__strip-label">Con real</span>
                    </li>
                    <li class="sg-match-panel__strip-item">
                      <span class="sg-match-panel__strip-value">
                        {{ evolution()?.alignedCount ?? 0 }}
                      </span>
                      <span class="sg-match-panel__strip-label">Alineados</span>
                    </li>
                    <li class="sg-match-panel__strip-item">
                      <span class="sg-match-panel__strip-value">{{ programCriticalCount() }}</span>
                      <span class="sg-match-panel__strip-label">Críticos</span>
                    </li>
                  </ul>

                  <footer class="sg-match-panel__foot">
                    <span class="sg-match-panel__time">{{ formatDate(p.startsAt) }}</span>
                    <span class="sg-match-panel__platform">
                      {{ p.cadence === 'monthly' ? 'Mensual' : 'Semanal' }}
                    </span>
                  </footer>
                </div>
              </article>

              <div class="sg-obj-summary__section-head">
                <h4 class="sg-obj-summary__section-title">Metas del programa</h4>
                <button
                  type="button"
                  class="sg-obj-panel__inline-link"
                  (click)="tab.set('compliance')"
                >
                  Ver cumplimiento →
                </button>
              </div>

              <ul class="sg-obj-program-targets">
                @for (card of programTargetCards(); track card.key) {
                  <li>
                    <article
                      class="sg-match-card u-surface-card sg-obj-program-target"
                      [attr.data-status]="card.status"
                    >
                      <div class="sg-match-card__body">
                        <header class="sg-match-card__header">
                          <div class="sg-match-card__meta">
                            <div class="sg-match-card__title-block">
                              <h3 class="sg-match-card__title">{{ card.label }}</h3>
                              <p class="sg-match-card__subtitle">
                                {{ card.domainLabel }}
                                · {{ card.goalKind === 'at_most' ? 'Tope' : 'Mínimo' }}
                                · {{ card.autoSource ? 'Auto' : 'Manual' }}
                              </p>
                            </div>
                          </div>
                          <div class="sg-match-card__badges">
                            <sg-neon-badge [tone]="statusTone(card.status)">
                              {{ card.statusLabel }}
                            </sg-neon-badge>
                          </div>
                        </header>

                        @if (card.description) {
                          <p class="sg-match-card__summary">{{ card.description }}</p>
                        }

                        <div class="sg-match-card__stats">
                          <sg-stat-value
                            label="Meta"
                            [value]="
                              (card.goalKind === 'at_most' ? '≤ ' : '≥ ') +
                              card.plannedValue +
                              ' ' +
                              card.unit
                            "
                            accent="gold"
                          />
                          <sg-stat-value
                            label="Real"
                            [value]="
                              card.actualValue != null
                                ? card.actualValue + ' ' + card.unit
                                : '—'
                            "
                            [accent]="card.actualValue != null ? 'cyan' : 'default'"
                          />
                          <sg-stat-value
                            label="Cumpl."
                            [value]="
                              card.compliancePct != null ? card.compliancePct + '%' : '—'
                            "
                            [accent]="statAccentForStatus(card.status)"
                          />
                          <sg-stat-value
                            label="Período"
                            [value]="card.periodId"
                          />
                        </div>
                      </div>
                    </article>
                  </li>
                }
              </ul>

              <div class="sg-obj-actions">
                <button type="button" class="u-btn u-btn--gold" (click)="openProgramModal('edit')">
                  Editar programa
                </button>
                <button type="button" class="u-btn u-btn--ghost" (click)="tab.set('reality')">
                  Cargar realidad
                </button>
                <button
                  type="button"
                  class="u-btn u-btn--ghost"
                  [disabled]="saving()"
                  (click)="closeActiveProgram()"
                >
                  Cerrar programa
                </button>
              </div>
              }
            </div>
          } @else {
            <div class="sg-obj-empty-card">
              <p class="sg-obj-empty u-m-0">
                Todavía no hay un programa activo. Armá uno con victorias, derrotas, KDA y más.
              </p>
              <button type="button" class="u-btn u-btn--gold" (click)="openProgramModal('create')">
                Crear programa
              </button>
            </div>
          }
        </div>
      }

      @if (tab() === 'reality') {
        <div class="sg-obj-panel__body" role="tabpanel">
          @if (!program()) {
            <div class="sg-obj-empty-card">
              <p class="sg-obj-empty u-m-0">Creá un programa activo antes de cargar realidad.</p>
              <button type="button" class="u-btn u-btn--gold" (click)="openProgramModal('create')">
                Crear programa
              </button>
            </div>
          } @else {
            <p class="sg-obj-hint u-m-0">
              Registrá la ejecución real del período o sincronizá KPIs desde tus partidas.
            </p>
            <div class="sg-obj-actions">
              <button type="button" class="u-btn u-btn--gold" (click)="openExecutionModal()">
                Registrar ejecución
              </button>
              <button
                type="button"
                class="u-btn u-btn--ghost"
                [disabled]="saving()"
                (click)="syncFromMatches()"
              >
                {{ saving() ? 'Sincronizando…' : 'Sincronizar desde partidas' }}
              </button>
            </div>
            @if (syncHint()) {
              <p class="sg-obj-hint u-m-0">{{ syncHint() }}</p>
            }
          }
        </div>
      }

      @if (tab() === 'compliance') {
        <div class="sg-obj-panel__body" role="tabpanel">
          @if (!evolution()) {
            <div class="sg-obj-empty-card">
              <p class="sg-obj-empty u-m-0">
                Todavía no hay nada que medir: definí metas en el programa y cargá al menos una
                ejecución real, o sincronizá los KPIs desde tus partidas.
              </p>
              <div class="sg-obj-actions">
                <button type="button" class="u-btn u-btn--gold" (click)="openBuilder()">
                  Ver programa
                </button>
                <button type="button" class="u-btn u-btn--ghost" (click)="tab.set('reality')">
                  Cargar realidad
                </button>
              </div>
            </div>
          } @else {
            <article
              class="sg-match-panel u-surface-card sg-obj-compliance-hero"
              [attr.data-status]="complianceOverallStatus()"
            >
              <div class="sg-match-panel__body">
                <header class="sg-match-panel__header">
                  <div class="sg-match-panel__title-block">
                    <p class="sg-match-panel__eyebrow">Plan vs realidad</p>
                    <h3 class="sg-match-panel__title">{{ evolution()!.title }}</h3>
                    <p class="sg-match-panel__summary">
                      {{ evolution()!.cadence === 'monthly' ? 'Cadencia mensual' : 'Cadencia semanal' }}
                      · {{ complianceRows().length }} metas
                      · {{ compliancePeriodLabel() }}
                    </p>
                  </div>

                  <div
                    class="sg-match-panel__score"
                    [attr.aria-label]="
                      'Cumplimiento global ' +
                      (evolution()!.globalCompliancePct != null
                        ? roundPct(evolution()!.globalCompliancePct!) + '%'
                        : 'sin dato')
                    "
                  >
                    <div class="sg-match-panel__score-part">
                      <span class="sg-match-panel__score-num">
                        {{
                          evolution()!.globalCompliancePct != null
                            ? roundPct(evolution()!.globalCompliancePct!) + '%'
                            : '—'
                        }}
                      </span>
                      <span class="sg-match-panel__score-label">Global</span>
                    </div>
                  </div>
                </header>

                <div class="sg-obj-gauge">
                  <div class="sg-obj-gauge__track">
                    <div
                      class="sg-obj-gauge__fill"
                      [style.width.%]="complianceGaugePct()"
                      [attr.data-status]="complianceOverallStatus()"
                    ></div>
                    <span class="sg-obj-gauge__goal" aria-hidden="true"></span>
                  </div>
                  <div class="sg-obj-gauge__legend">
                    <span>0%</span>
                    <span class="sg-obj-gauge__legend-goal">Meta 100%</span>
                    <span>133%+</span>
                  </div>
                  <p class="sg-obj-gauge__caption u-m-0">{{ complianceHeadline() }}</p>
                </div>

                <ul class="sg-match-panel__strip" aria-label="Distribución de metas">
                  <li class="sg-match-panel__strip-item">
                    <span class="sg-match-panel__strip-value">{{ complianceCounts().aligned }}</span>
                    <span class="sg-match-panel__strip-label">Alineadas</span>
                  </li>
                  <li class="sg-match-panel__strip-item">
                    <span class="sg-match-panel__strip-value">{{ complianceCounts().above }}</span>
                    <span class="sg-match-panel__strip-label">Excedidas</span>
                  </li>
                  <li class="sg-match-panel__strip-item">
                    <span class="sg-match-panel__strip-value">{{ complianceCounts().critical }}</span>
                    <span class="sg-match-panel__strip-label">Críticas</span>
                  </li>
                  <li class="sg-match-panel__strip-item">
                    <span class="sg-match-panel__strip-value">{{ complianceCounts().pending }}</span>
                    <span class="sg-match-panel__strip-label">Sin dato</span>
                  </li>
                </ul>
              </div>
            </article>

            @if (complianceFocus(); as focus) {
              <aside class="sg-obj-focus-card" [attr.data-status]="focus.status">
                <p class="sg-obj-focus-card__eyebrow u-m-0">Foco recomendado</p>
                <p class="sg-obj-focus-card__title u-m-0">{{ focus.metricLabel }}</p>
                <p class="sg-obj-focus-card__body u-m-0">{{ complianceFocusAdvice() }}</p>
                @if (complianceBest(); as best) {
                  <p class="sg-obj-focus-card__note u-m-0">
                    Sostené <strong>{{ best.metricLabel }}</strong> ({{ best.pctLabel }}): ahí el plan
                    ya se está cumpliendo.
                  </p>
                }
                <button type="button" class="u-btn u-btn--ghost" (click)="tab.set('reality')">
                  Actualizar realidad
                </button>
              </aside>
            }

            <div class="sg-obj-history-filters" role="group" aria-label="Filtrar metas por estado">
              <button
                type="button"
                class="sg-obj-history-filter"
                [class.sg-obj-history-filter--active]="complianceFilter() === 'all'"
                (click)="complianceFilter.set('all')"
              >
                Todas ({{ complianceCounts().all }})
              </button>
              <button
                type="button"
                class="sg-obj-history-filter"
                [class.sg-obj-history-filter--active]="complianceFilter() === 'critical'"
                (click)="complianceFilter.set('critical')"
              >
                Críticas ({{ complianceCounts().critical }})
              </button>
              <button
                type="button"
                class="sg-obj-history-filter"
                [class.sg-obj-history-filter--active]="complianceFilter() === 'aligned'"
                (click)="complianceFilter.set('aligned')"
              >
                Alineadas ({{ complianceCounts().aligned }})
              </button>
              <button
                type="button"
                class="sg-obj-history-filter"
                [class.sg-obj-history-filter--active]="complianceFilter() === 'above'"
                (click)="complianceFilter.set('above')"
              >
                Excedidas ({{ complianceCounts().above }})
              </button>
              <button
                type="button"
                class="sg-obj-history-filter"
                [class.sg-obj-history-filter--active]="complianceFilter() === 'pending'"
                (click)="complianceFilter.set('pending')"
              >
                Sin dato ({{ complianceCounts().pending }})
              </button>
            </div>

            @if (!complianceGroups().length) {
              <p class="sg-obj-empty u-m-0">No hay metas con este estado en el programa.</p>
            } @else {
              @for (group of complianceGroups(); track group.periodId) {
                <section class="sg-obj-compliance-group">
                  <div class="sg-obj-summary__section-head">
                    <h4 class="sg-obj-summary__section-title">Período {{ group.periodId }}</h4>
                    <span class="sg-obj-compliance-group__count">
                      {{ group.rows.length }} metas
                    </span>
                  </div>

                  <ul class="sg-obj-compliance-list">
                    @for (row of group.rows; track row.key) {
                      <li class="sg-obj-compliance-row" [attr.data-status]="row.status">
                        <div class="sg-obj-compliance-row__head">
                          <div class="sg-obj-compliance-row__ident">
                            <p class="sg-obj-compliance-row__label u-m-0">{{ row.metricLabel }}</p>
                            <p class="sg-obj-compliance-row__meta u-m-0">
                              {{ row.domainLabel }} · {{ row.goalLabel }} · {{ row.sourceLabel }}
                            </p>
                          </div>
                          <sg-neon-badge [tone]="statusTone(row.status)">
                            {{ row.statusLabel }}
                          </sg-neon-badge>
                        </div>

                        <div
                          class="sg-obj-compliance-row__bar"
                          role="img"
                          [attr.aria-label]="
                            row.metricLabel +
                            ': real ' +
                            row.actualLabel +
                            ' sobre plan ' +
                            row.planLabel +
                            ' (' +
                            row.pctLabel +
                            ')'
                          "
                        >
                          <div class="sg-obj-compliance-row__track">
                            <div
                              class="sg-obj-compliance-row__fill"
                              [style.width.%]="row.barPct"
                            ></div>
                            <span class="sg-obj-compliance-row__goal" aria-hidden="true"></span>
                          </div>
                          <span class="sg-obj-compliance-row__pct">{{ row.pctLabel }}</span>
                        </div>

                        <dl class="sg-obj-compliance-row__values">
                          <div>
                            <dt>Plan</dt>
                            <dd>{{ row.planLabel }}</dd>
                          </div>
                          <div>
                            <dt>Real</dt>
                            <dd>{{ row.actualLabel }}</dd>
                          </div>
                          <div>
                            <dt>Desvío</dt>
                            <dd [attr.data-tone]="row.deltaTone">{{ row.deltaLabel }}</dd>
                          </div>
                        </dl>
                      </li>
                    }
                  </ul>
                </section>
              }
            }

            <sg-stats-comparison-chart
              title="Plan vs Real por métrica"
              subtitle="Barras: meta planificada vs ejecución acumulada del programa."
              youLabel="Real"
              benchmarkLabel="Plan"
              [rows]="chartRows()"
            />

            <p class="sg-obj-hint u-m-0">
              Esto mide plan vs realidad del programa.
              <a routerLink="/tabs/analytics" class="sg-obj-panel__inline-link">
                Ver forma táctica en Evolución →
              </a>
            </p>
          }
        </div>
      }

      @if (tab() === 'history') {
        <div class="sg-obj-panel__body" role="tabpanel">
          <div class="sg-obj-history-filters" role="group" aria-label="Filtrar historial">
            <button
              type="button"
              class="sg-obj-history-filter"
              [class.sg-obj-history-filter--active]="historyFilter() === 'all'"
              (click)="historyFilter.set('all')"
            >
              Todos ({{ historyInTimeRange().length }})
            </button>
            <button
              type="button"
              class="sg-obj-history-filter"
              [class.sg-obj-history-filter--active]="historyFilter() === 'in_progress'"
              (click)="historyFilter.set('in_progress')"
            >
              En curso ({{ historyCounts().in_progress }})
            </button>
            <button
              type="button"
              class="sg-obj-history-filter"
              [class.sg-obj-history-filter--active]="historyFilter() === 'fulfilled'"
              (click)="historyFilter.set('fulfilled')"
            >
              Cumplidos ({{ historyCounts().fulfilled }})
            </button>
            <button
              type="button"
              class="sg-obj-history-filter"
              [class.sg-obj-history-filter--active]="historyFilter() === 'not_fulfilled'"
              (click)="historyFilter.set('not_fulfilled')"
            >
              No cumplidos ({{ historyCounts().not_fulfilled }})
            </button>
          </div>

          @if (!filteredHistory().length) {
            <p class="sg-obj-empty u-m-0">Todavía no hay programas en este filtro.</p>
          } @else {
            <ul class="sg-obj-history-list">
              @for (item of filteredHistory(); track item.programId) {
                <li class="sg-obj-history-card" [attr.data-outcome]="item.outcome">
                  <div class="sg-obj-history-card__top">
                    <div>
                      <h3 class="sg-obj-history-card__title">{{ item.title }}</h3>
                      <p class="sg-obj-history-card__meta u-m-0">
                        {{ item.cadence === 'monthly' ? 'Mensual' : 'Semanal' }}
                        · {{ item.startsAt.slice(0, 10) }}
                        @if (item.endsAt) {
                          → {{ item.endsAt.slice(0, 10) }}
                        }
                        · {{ item.targetCount }} metas
                        · {{ item.executionCount }} registros
                      </p>
                    </div>
                    <sg-neon-badge [tone]="outcomeTone(item.outcome)">
                      {{ item.outcomeLabel }}
                    </sg-neon-badge>
                  </div>
                  <div class="sg-obj-history-card__foot">
                    <span class="sg-obj-history-card__pct">
                      {{ complianceLabel(item.globalCompliancePct) }}
                    </span>
                    <button
                      type="button"
                      class="u-btn u-btn--ghost"
                      (click)="inspectHistoryItem(item)"
                    >
                      Ver cumplimiento
                    </button>
                  </div>
                </li>
              }
            </ul>
          }
        </div>
      }
    </section>

    @if (modal() === 'program') {
      <div
        class="sg-match-modal sg-obj-modal--fullscreen"
        role="presentation"
        (click)="closeModal()"
        @sgFadeSlideIn
      >
        <div class="sg-match-modal__wings" aria-hidden="true">
          <div
            class="sg-match-modal__wing sg-match-modal__wing--left"
            [style.background-image]="'url(' + modalWingArtUrl() + ')'"
          ></div>
          <div
            class="sg-match-modal__wing sg-match-modal__wing--right"
            [style.background-image]="'url(' + modalWingArtUrl() + ')'"
          ></div>
        </div>

        <button
          type="button"
          class="sg-match-modal__close"
          aria-label="Cerrar"
          (click)="closeModal()"
        >
          <span aria-hidden="true">×</span>
        </button>

        <div
          class="sg-match-modal__dialog page-shell page-shell--fluid sg-obj-modal__dialog--fullscreen"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sg-obj-modal-program-title"
          (click)="$event.stopPropagation()"
          @sgModalIn
        >
          <header class="sg-match-modal__header">
            <div>
              <p class="sg-match-modal__eyebrow">Programa</p>
              <h3 id="sg-obj-modal-program-title" class="sg-match-modal__title">
                {{ programModalMode() === 'create' ? 'Nuevo programa' : 'Editar programa' }}
              </h3>
              <p class="sg-match-modal__subtitle u-m-0">
                Elegí parámetros por dominio: competitivo, disciplina, mental, economía, técnica y más.
              </p>
            </div>
          </header>

          <div class="sg-match-modal__body sg-obj-modal__body">
            <label class="sg-obj-field">
              <span>Título del programa</span>
              <input type="text" [(ngModel)]="title" placeholder="Ej. Prep ranked Q3" />
            </label>

            <div class="sg-obj-row">
              <label class="sg-obj-field">
                <span>Cadencia</span>
                <select [(ngModel)]="cadence" (ngModelChange)="onCadenceChange()">
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensual</option>
                </select>
              </label>
              <label class="sg-obj-field">
                <span>Inicio</span>
                <input type="date" [(ngModel)]="startsAt" />
              </label>
            </div>

            <div class="sg-obj-targets">
              <div class="sg-obj-targets__head">
                <div>
                  <h4 class="sg-obj-targets__title">Parámetros / metas</h4>
                  <p class="sg-obj-targets__period u-m-0">
                    Período activo:
                    <strong>{{ draftPeriodId() }}</strong>
                    · lo define la cadencia (no se edita por fila)
                  </p>
                </div>
                <button type="button" class="u-btn u-btn--ghost" (click)="addTargetRow()">
                  + Parámetro
                </button>
              </div>

              <div class="sg-obj-target-row sg-obj-target-row--head" aria-hidden="true">
                <span>Parámetro</span>
                <span></span>
                <span>Meta</span>
                <span></span>
              </div>

              @for (row of draftTargets(); track $index) {
                <div class="sg-obj-target-block">
                  <div class="sg-obj-target-row sg-obj-target-row--modal">
                    <select
                      [ngModel]="row.metricTypeId"
                      (ngModelChange)="setDraftMetric($index, $event)"
                      [ngModelOptions]="{ standalone: true }"
                      [attr.aria-label]="'Parámetro ' + ($index + 1)"
                      [attr.aria-describedby]="'sg-obj-metric-help-' + $index"
                    >
                      @for (group of metricGroups(); track group.domain) {
                        <optgroup [label]="group.label">
                          @for (m of group.metrics; track m.id) {
                            <option [ngValue]="m.id">{{ metricOptionLabel(m) }}</option>
                          }
                        </optgroup>
                      }
                    </select>
                    <button
                      type="button"
                      class="sg-obj-metric-help"
                      [class.sg-obj-metric-help--open]="helpMetricIndex() === $index"
                      [attr.aria-expanded]="helpMetricIndex() === $index"
                      [attr.aria-controls]="'sg-obj-metric-help-' + $index"
                      [attr.aria-label]="'Qué es ' + metricLabel(row.metricTypeId)"
                      [attr.title]="metricHelpTitle(row.metricTypeId)"
                      (click)="toggleMetricHelp($index)"
                    >
                      ?
                    </button>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      [ngModel]="row.plannedValue"
                      (ngModelChange)="setDraftPlanned($index, $event)"
                      [ngModelOptions]="{ standalone: true }"
                      [attr.aria-label]="'Meta ' + ($index + 1)"
                      [placeholder]="goalPlaceholder(row.metricTypeId)"
                    />
                    <button
                      type="button"
                      class="sg-obj-target-row__remove"
                      (click)="removeTargetRow($index)"
                      aria-label="Quitar parámetro"
                    >
                      ✕
                    </button>
                  </div>
                  @if (helpMetricIndex() === $index) {
                    <aside
                      class="sg-obj-metric-help-panel"
                      [id]="'sg-obj-metric-help-' + $index"
                      role="note"
                    >
                      <p class="sg-obj-metric-help-panel__title u-m-0">
                        {{ metricLabel(row.metricTypeId) }}
                      </p>
                      <p class="sg-obj-metric-help-panel__body u-m-0">
                        {{ metricDescription(row.metricTypeId) }}
                      </p>
                      <ul class="sg-obj-metric-help-panel__meta">
                        <li><strong>Unidad:</strong> {{ metricUnit(row.metricTypeId) || '—' }}</li>
                        <li>
                          <strong>Tipo de meta:</strong>
                          {{ metricGoalKindLabel(row.metricTypeId) }}
                        </li>
                        <li>
                          <strong>Origen:</strong>
                          {{ metricSourceLabel(row.metricTypeId) }}
                        </li>
                      </ul>
                    </aside>
                  }
                </div>
              }
            </div>
          </div>

          <footer class="sg-obj-modal__footer sg-obj-modal__footer--fullscreen">
            <button type="button" class="u-btn u-btn--ghost" (click)="closeModal()">Cancelar</button>
            <button
              type="button"
              class="u-btn u-btn--gold"
              [disabled]="saving()"
              (click)="saveProgram()"
            >
              {{ saving() ? 'Guardando…' : 'Guardar programa' }}
            </button>
          </footer>
        </div>
      </div>
    }

    @if (modal() === 'execution') {
      <div class="sg-obj-modal" role="presentation" (click)="closeModal()" @sgFadeSlideIn>
        <div
          class="sg-obj-modal__dialog sg-obj-modal__dialog--sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sg-obj-modal-exec-title"
          (click)="$event.stopPropagation()"
          @sgModalIn
        >
          <header class="sg-obj-modal__header">
            <div>
              <p class="sg-obj-modal__eyebrow">Realidad</p>
              <h3 id="sg-obj-modal-exec-title" class="sg-obj-modal__title">Registrar ejecución</h3>
              <p class="sg-obj-modal__subtitle u-m-0">
                Cargá el valor real del período para un parámetro del programa.
              </p>
            </div>
            <button type="button" class="sg-obj-modal__close" aria-label="Cerrar" (click)="closeModal()">
              ×
            </button>
          </header>

          <div class="sg-obj-modal__body">
            <div class="sg-obj-row">
              <label class="sg-obj-field">
                <span>Parámetro</span>
                <select [(ngModel)]="execMetricId">
                  @for (m of programMetrics(); track m) {
                    <option [value]="m">{{ metricLabel(m) }}</option>
                  }
                </select>
              </label>
              <label class="sg-obj-field">
                <span>Período</span>
                <input type="text" [(ngModel)]="execPeriodId" />
              </label>
              <label class="sg-obj-field">
                <span>Valor real</span>
                <input type="number" min="0" step="0.1" [(ngModel)]="execValue" />
              </label>
            </div>
          </div>

          <footer class="sg-obj-modal__footer">
            <button type="button" class="u-btn u-btn--ghost" (click)="closeModal()">Cancelar</button>
            <button
              type="button"
              class="u-btn u-btn--gold"
              [disabled]="saving()"
              (click)="saveExecution()"
            >
              {{ saving() ? 'Guardando…' : 'Guardar ejecución' }}
            </button>
          </footer>
        </div>
      </div>
    }
  `,
})
export class ObjectivesPlanPanelComponent implements OnDestroy {
  private readonly objectives = inject(ObjectivesService);
  private readonly document = inject(DOCUMENT);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly userId = input.required<string>();
  readonly platform = input<string | null>(null);
  /** Rango compartido (Día / Semana / 30d / 90d) para filtrar historial. */
  readonly timeRange = input<AnalysisRangeId>('week');
  readonly selectedDayIso = input<string>(todayPeriodId());
  /** La página lo incrementa en ionViewWillEnter para forzar recarga. */
  readonly reloadNonce = input(0);
  readonly dataChanged = output<void>();

  readonly tab = signal<ObjTab>('builder');
  readonly modal = signal<ModalKind>(null);
  readonly programModalMode = signal<'create' | 'edit'>('create');
  readonly metrics = signal<ObjectiveMetricTypeView[]>(seedMetricCatalog());
  readonly program = signal<TargetProgramView | null>(null);
  readonly evolution = signal<ObjectiveEvolutionView | null>(null);
  readonly history = signal<TargetProgramHistoryItemView[]>([]);
  /** Snapshot local para no perder activos entre cargas concurrentes / refresh. */
  readonly cachedPrograms = signal<TargetProgramView[]>([]);
  readonly historyFilter = signal<HistoryFilter>('all');
  readonly complianceFilter = signal<ComplianceFilter>('all');
  readonly draftTargets = signal<DraftTargetRow[]>([]);
  readonly helpMetricIndex = signal<number | null>(null);
  readonly saving = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly syncHint = signal<string | null>(null);

  title = 'Mi programa de objetivos';
  cadence: 'weekly' | 'monthly' = 'weekly';
  startsAt = new Date().toISOString().slice(0, 10);
  execMetricId = '';
  execPeriodId = currentIsoWeekPeriodId();
  execValue: number | null = null;

  readonly metricGroups = computed(() => {
    const byDomain = new Map<string, ObjectiveMetricTypeView[]>();
    for (const m of this.metrics()) {
      const list = byDomain.get(m.domain) ?? [];
      list.push(m);
      byDomain.set(m.domain, list);
    }

    const ordered: string[] = [
      ...OBJECTIVE_DOMAIN_ORDER.filter((d) => byDomain.has(d)),
      ...[...byDomain.keys()].filter(
        (d) => !(OBJECTIVE_DOMAIN_ORDER as readonly string[]).includes(d),
      ),
    ];

    return ordered.map((domain) => ({
      domain,
      label:
        OBJECTIVE_DOMAIN_LABELS[domain as ObjectiveMetricDomain] ?? domain,
      metrics: byDomain.get(domain) ?? [],
    }));
  });

  readonly programMetrics = computed(() => {
    const ids = this.program()?.targets.map((t) => t.metricTypeId) ?? [];
    return [...new Set(ids)];
  });

  readonly programTargetCards = computed(() => {
    const prog = this.program();
    if (!prog) return [];
    const evoRows = this.evolution()?.rows ?? [];
    const evoByKey = new Map(
      evoRows.map((r) => [`${r.metricTypeId}#${r.periodId}`, r] as const),
    );

    return prog.targets.map((t) => {
      const meta = this.metrics().find((m) => m.id === t.metricTypeId);
      const evo = evoByKey.get(`${t.metricTypeId}#${t.periodId}`);
      const domain = meta?.domain ?? 'competitive';
      return {
        key: `${t.metricTypeId}#${t.periodId}`,
        metricTypeId: t.metricTypeId,
        label: meta?.label ?? t.metricTypeId,
        description: meta?.description ?? '',
        unit: meta?.unit ?? '',
        domainLabel:
          OBJECTIVE_DOMAIN_LABELS[domain as ObjectiveMetricDomain] ?? domain,
        goalKind: meta?.goalKind ?? 'at_least',
        autoSource: Boolean(meta?.autoSource),
        plannedValue: t.plannedValue,
        periodId: t.periodId,
        actualValue: evo?.actualValue ?? null,
        compliancePct: evo?.compliancePct ?? null,
        status: evo?.status ?? 'critical',
        statusLabel: evo?.statusLabel ?? 'Sin dato',
      };
    });
  });

  readonly programPeriodLabel = computed(() => {
    const cards = this.programTargetCards();
    const periods = [...new Set(cards.map((c) => c.periodId))];
    if (periods.length === 1) return periods[0]!;
    if (periods.length > 1) return `${periods.length} períodos`;
    return this.draftPeriodId();
  });

  readonly programCompliancePct = computed(
    () => this.evolution()?.globalCompliancePct ?? null,
  );

  readonly programTrackedCount = computed(
    () => this.programTargetCards().filter((c) => c.actualValue != null).length,
  );

  readonly programCriticalCount = computed(
    () =>
      this.evolution()?.criticalCount ??
      this.programTargetCards().filter((c) => c.status === 'critical').length,
  );

  readonly chartRows = computed((): StatsComparisonRow[] => {
    const evo = this.evolution();
    if (!evo) return [];
    return evo.byMetric.map((m) => ({
      label: m.metricLabel,
      you: m.actualTotal,
      benchmark: m.plannedTotal,
    }));
  });

  readonly complianceRows = computed((): ComplianceRowVm[] => {
    const evo = this.evolution();
    if (!evo) return [];
    const catalog = this.metrics();

    return evo.rows.map((row) => {
      const meta = catalog.find((m) => m.id === row.metricTypeId);
      const domain = meta?.domain ?? 'competitive';
      const goalKind = meta?.goalKind ?? 'at_least';
      const isCeiling = goalKind === 'at_most';
      const hasActual = row.actualValue != null;
      const unit = row.unit || meta?.unit || '';
      const pct = row.compliancePct ?? null;
      const status: ComplianceStatus = hasActual
        ? ((row.status as ComplianceStatus) ?? 'critical')
        : 'pending';
      const delta = hasActual ? (row.actualValue as number) - row.plannedValue : null;

      return {
        key: `${row.metricTypeId}#${row.periodId}`,
        metricTypeId: row.metricTypeId,
        metricLabel: row.metricLabel || meta?.label || row.metricTypeId,
        domainLabel: OBJECTIVE_DOMAIN_LABELS[domain as ObjectiveMetricDomain] ?? domain,
        goalLabel: isCeiling ? 'Tope máximo' : 'Meta mínima',
        sourceLabel: meta?.autoSource ? 'Auto' : 'Manual',
        periodId: row.periodId,
        unit,
        planLabel: `${isCeiling ? '≤' : '≥'} ${formatMetricValue(row.plannedValue, unit)}`,
        actualLabel: hasActual
          ? formatMetricValue(row.actualValue as number, unit)
          : 'Sin cargar',
        pctLabel: pct != null ? `${Math.round(pct)}%` : '—',
        compliancePct: pct,
        barPct: complianceBarWidth(pct),
        deltaLabel: formatDeltaValue(delta, unit),
        deltaTone: deltaToneForStatus(status),
        status,
        statusLabel: hasActual ? row.statusLabel : 'Sin dato',
      };
    });
  });

  readonly complianceCounts = computed(() => {
    const rows = this.complianceRows();
    return {
      all: rows.length,
      aligned: rows.filter((r) => r.status === 'aligned').length,
      above: rows.filter((r) => r.status === 'above').length,
      critical: rows.filter((r) => r.status === 'critical').length,
      pending: rows.filter((r) => r.status === 'pending').length,
    };
  });

  readonly filteredComplianceRows = computed(() => {
    const filter = this.complianceFilter();
    const rows = this.complianceRows();
    if (filter === 'all') return rows;
    return rows.filter((r) => r.status === filter);
  });

  /** Agrupa por período (más reciente primero) para leer la evolución del plan. */
  readonly complianceGroups = computed(() => {
    const byPeriod = new Map<string, ComplianceRowVm[]>();
    for (const row of this.filteredComplianceRows()) {
      const list = byPeriod.get(row.periodId) ?? [];
      list.push(row);
      byPeriod.set(row.periodId, list);
    }
    return [...byPeriod.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([periodId, rows]) => ({
        periodId,
        rows: [...rows].sort((a, b) => complianceSortWeight(a) - complianceSortWeight(b)),
      }));
  });

  readonly compliancePeriodLabel = computed(() => {
    const periods = [...new Set(this.complianceRows().map((r) => r.periodId))];
    if (!periods.length) return this.draftPeriodId();
    if (periods.length === 1) return periods[0]!;
    return `${periods.length} períodos`;
  });

  readonly complianceOverallStatus = computed((): ComplianceStatus => {
    const counts = this.complianceCounts();
    if (counts.all > 0 && counts.pending === counts.all) return 'pending';
    const pct = this.evolution()?.globalCompliancePct;
    if (pct == null) return 'pending';
    if (pct < 90) return 'critical';
    if (pct > 115) return 'above';
    return 'aligned';
  });

  readonly complianceGaugePct = computed(() =>
    complianceBarWidth(this.evolution()?.globalCompliancePct ?? null),
  );

  /** Meta más floja: el próximo punto de mejora del programa. */
  readonly complianceFocus = computed((): ComplianceRowVm | null => {
    const rows = this.complianceRows();
    const critical = rows
      .filter((r) => r.status === 'critical')
      .sort((a, b) => (a.compliancePct ?? 0) - (b.compliancePct ?? 0));
    if (critical.length) return critical[0]!;
    const pending = rows.filter((r) => r.status === 'pending');
    if (pending.length) return pending[0]!;
    return null;
  });

  readonly complianceBest = computed((): ComplianceRowVm | null => {
    const rows = this.complianceRows()
      .filter((r) => r.status === 'aligned' && r.compliancePct != null)
      .sort((a, b) => (b.compliancePct ?? 0) - (a.compliancePct ?? 0));
    return rows[0] ?? null;
  });

  readonly historyCounts = computed(() => {
    const rows = this.historyInTimeRange();
    return {
      in_progress: rows.filter((r) => r.outcome === 'in_progress').length,
      fulfilled: rows.filter((r) => r.outcome === 'fulfilled').length,
      not_fulfilled: rows.filter((r) => r.outcome === 'not_fulfilled').length,
    };
  });

  readonly historyInTimeRange = computed(() => {
    const range = this.timeRange();
    const day = this.selectedDayIso();
    // Historial = programas cerrados / no activos.
    return this.history().filter(
      (item) =>
        item.status !== 'active' &&
        !item.isActive &&
        isoInAnalysisRange(item.startsAt, range, day),
    );
  });

  readonly activePrograms = computed(() => {
    const byId = new Map<string, TargetProgramHistoryItemView>();
    const rows = this.history();

    const isListedActive = (item: TargetProgramHistoryItemView): boolean => {
      const status = String(item.status ?? '').toLowerCase();
      if (status === 'active' || item.isActive) return true;
      if (status === 'archived' || status === 'closed' || status === 'completed') return false;
      // En curso / draft / desconocido: mostrar en la lista de programas.
      return item.outcome === 'in_progress' || status === 'draft' || status === '';
    };

    for (const item of rows) {
      if (isListedActive(item)) byId.set(item.programId, item);
    }

    // Si el filtro dejó todo afuera pero hay historial, mostrar no-archivados.
    if (!byId.size && rows.length) {
      for (const item of rows) {
        const status = String(item.status ?? '').toLowerCase();
        if (status !== 'archived') byId.set(item.programId, item);
      }
    }

    // Último recurso: si hay programas en historial, listarlos todos.
    if (!byId.size && rows.length) {
      for (const item of rows) byId.set(item.programId, item);
    }

    for (const cached of this.cachedPrograms()) {
      if (!byId.has(cached.programId)) {
        byId.set(cached.programId, historyItemFromProgram(cached));
      }
    }

    const focused = this.program();
    if (focused && !byId.has(focused.programId)) {
      byId.set(focused.programId, historyItemFromProgram(focused));
    }

    return [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  });

  readonly filteredHistory = computed(() => {
    const filter = this.historyFilter();
    const rows = this.historyInTimeRange();
    if (filter === 'all') return rows;
    return rows.filter((r) => r.outcome === filter);
  });

  private bootstrapSeq = 0;

  constructor() {
    // Angular 17: sin allowSignalWrites, un .set() dentro del effect aborta y
    // bootstrap nunca corre → al entrar a Objetivos no se ven los programas.
    effect(
      () => {
        const uid = this.userId();
        const nonce = this.reloadNonce();
        if (!uid) return;
        void this.bootstrap(uid, nonce > 0);
      },
      { allowSignalWrites: true },
    );
  }

  ngOnDestroy(): void {
    this.unlockBody();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.modal()) this.closeModal();
  }

  onCadenceChange(): void {
    const period = this.draftPeriodId();
    this.draftTargets.update((rows) => rows.map((r) => ({ ...r, periodId: period })));
    this.execPeriodId = period;
  }

  draftPeriodId(): string {
    return this.cadence === 'monthly' ? currentMonthPeriodId() : currentIsoWeekPeriodId();
  }

  formatDate(iso: string): string {
    const day = iso.slice(0, 10);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
    if (!match) return day;
    return `${match[3]}/${match[2]}/${match[1]}`;
  }

  openProgramModal(mode: 'create' | 'edit'): void {
    this.programModalMode.set(mode);
    this.error.set(null);
    if (mode === 'create') {
      this.title = 'Mi programa de objetivos';
      this.cadence = 'weekly';
      this.startsAt = new Date().toISOString().slice(0, 10);
      this.draftTargets.set([]);
      this.addTargetRow();
      this.addTargetRow('wins');
      this.addTargetRow('losses');
    } else {
      const active = this.program();
      if (!active) {
        this.openProgramModal('create');
        return;
      }
      this.title = active.title;
      this.cadence = active.cadence === 'monthly' ? 'monthly' : 'weekly';
      this.startsAt = active.startsAt.slice(0, 10);
      this.draftTargets.set(
        active.targets.map((t) => ({
          metricTypeId: t.metricTypeId,
          periodId: t.periodId,
          plannedValue: t.plannedValue,
        })),
      );
    }
    this.modal.set('program');
    this.lockBody();
  }

  openExecutionModal(): void {
    if (!this.program()) return;
    this.execValue = null;
    this.execMetricId = this.programMetrics()[0] ?? '';
    this.execPeriodId =
      this.cadence === 'monthly' ? currentMonthPeriodId() : currentIsoWeekPeriodId();
    this.error.set(null);
    this.modal.set('execution');
    this.lockBody();
  }

  closeModal(): void {
    this.modal.set(null);
    this.helpMetricIndex.set(null);
    this.unlockBody();
  }

  addTargetRow(preferredMetricId?: string): void {
    const metrics = this.metrics();
    const period = this.draftPeriodId();
    const preferred =
      preferredMetricId && metrics.some((m) => m.id === preferredMetricId)
        ? preferredMetricId
        : undefined;
    const used = new Set(this.draftTargets().map((r) => r.metricTypeId));
    const nextUnused = metrics.find((m) => !used.has(m.id))?.id;
    this.draftTargets.update((rows) => [
      ...rows,
      {
        metricTypeId: preferred ?? nextUnused ?? metrics[0]?.id ?? 'wins',
        periodId: period,
        plannedValue: null,
      },
    ]);
  }

  removeTargetRow(index: number): void {
    this.draftTargets.update((rows) => rows.filter((_, i) => i !== index));
    this.helpMetricIndex.update((current) => {
      if (current == null) return null;
      if (current === index) return null;
      return current > index ? current - 1 : current;
    });
  }

  metricLabel(id: string): string {
    return this.metrics().find((m) => m.id === id)?.label ?? id;
  }

  metricUnit(id: string): string {
    return this.metrics().find((m) => m.id === id)?.unit ?? '';
  }

  metricDescription(id: string): string {
    return (
      this.metrics().find((m) => m.id === id)?.description ??
      'Sin descripción para este parámetro.'
    );
  }

  metricGoalKindLabel(id: string): string {
    const m = this.metrics().find((x) => x.id === id);
    if (!m) return '—';
    return m.goalKind === 'at_most'
      ? 'Tope máximo (cuanto menos, mejor)'
      : 'Meta mínima (cuanto más, mejor)';
  }

  metricSourceLabel(id: string): string {
    const m = this.metrics().find((x) => x.id === id);
    if (!m) return '—';
    return m.autoSource
      ? 'Automático desde partidas (Sincronizar)'
      : 'Manual (lo cargás en Realidad)';
  }

  metricHelpTitle(id: string): string {
    return this.metricDescription(id);
  }

  toggleMetricHelp(index: number): void {
    this.helpMetricIndex.update((current) => (current === index ? null : index));
  }

  metricOptionLabel(m: ObjectiveMetricTypeView): string {
    return `${m.label} (${m.unit})`;
  }

  goalPlaceholder(metricTypeId: string): string {
    const m = this.metrics().find((x) => x.id === metricTypeId);
    return m?.goalKind === 'at_most' ? 'Tope máx' : 'Meta mín';
  }

  setDraftMetric(index: number, metricTypeId: string): void {
    this.draftTargets.update((rows) =>
      rows.map((row, i) => (i === index ? { ...row, metricTypeId } : row)),
    );
    this.helpMetricIndex.set(index);
  }

  setDraftPlanned(index: number, value: number | string | null): void {
    const plannedValue =
      value === '' || value == null ? null : Number(value);
    this.draftTargets.update((rows) =>
      rows.map((row, i) =>
        i === index
          ? {
              ...row,
              plannedValue:
                plannedValue != null && Number.isFinite(plannedValue)
                  ? plannedValue
                  : null,
            }
          : row,
      ),
    );
  }

  async syncFromMatches(): Promise<void> {
    const uid = this.userId();
    const prog = this.program();
    if (!uid || !prog) return;

    this.saving.set(true);
    this.error.set(null);
    this.syncHint.set(null);
    try {
      const periodId =
        this.cadence === 'monthly' ? currentMonthPeriodId() : currentIsoWeekPeriodId();
      const result = await this.objectives.syncActualsFromMatchesOnce({
        userId: uid,
        programId: prog.programId,
        periodId,
        platform: this.platform() ?? prog.platform ?? undefined,
      });
      this.syncHint.set(
        `Sincronizado ${result.synced.length} métricas desde ${result.matchCount} partidas` +
          (result.skipped.length ? ` · ${result.skipped.length} omitidas` : '') +
          ` · ${result.periodId}.`,
      );
      await this.refreshEvolution(uid, prog.programId);
      this.dataChanged.emit();
    } catch (err) {
      this.error.set(
        extractGraphqlErrorMessage(err) || 'No se pudo sincronizar desde partidas.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  statusTone(status: string): 'lime' | 'cyan' | 'purple' | 'pink' | 'muted' | 'gold' {
    if (status === 'aligned') return 'lime';
    if (status === 'above') return 'cyan';
    if (status === 'critical') return 'pink';
    return 'muted';
  }

  statAccentForStatus(status: string): 'default' | 'lime' | 'cyan' | 'pink' | 'gold' {
    if (status === 'aligned') return 'lime';
    if (status === 'above') return 'cyan';
    if (status === 'critical') return 'pink';
    return 'default';
  }

  programHeroStatus(): string {
    const pct = this.programCompliancePct();
    if (pct == null) return 'critical';
    if (pct < 90) return 'critical';
    if (pct > 115) return 'above';
    return 'aligned';
  }

  programHeroOutcome(): 'win' | 'loss' | 'neutral' {
    const status = this.programHeroStatus();
    if (status === 'aligned' || status === 'above') return 'win';
    if (this.programTrackedCount() === 0) return 'neutral';
    return 'loss';
  }

  /** Listón: máx ~8 caracteres para no desbordar la cinta. */
  programHeroStatusLabel(): string {
    if (this.programTrackedCount() === 0) return 'Sin dato';
    const status = this.programHeroStatus();
    if (status === 'aligned') return 'Alineado';
    if (status === 'above') return 'Excedido';
    return 'Crítico';
  }

  outcomeTone(outcome: string): 'lime' | 'cyan' | 'purple' | 'pink' | 'muted' | 'gold' {
    if (outcome === 'fulfilled') return 'lime';
    if (outcome === 'in_progress') return 'cyan';
    if (outcome === 'not_fulfilled') return 'pink';
    return 'muted';
  }

  complianceLabel(pct: number | null | undefined): string {
    return pct != null ? `${Math.round(pct)}% cumplimiento` : 'Sin ejecución cargada';
  }

  /** Lectura del cumplimiento global en tono directo para el jugador. */
  complianceHeadline(): string {
    const counts = this.complianceCounts();
    switch (this.complianceOverallStatus()) {
      case 'pending':
        return 'Sin ejecución cargada todavía. Sincronizá desde partidas para que el plan empiece a medirse.';
      case 'critical':
        return `Estás por debajo del plan: ${counts.critical} de ${counts.all} metas en rojo. Priorizá una sola y sostenela.`;
      case 'above':
        return 'Superás el plan con holgura. Si ya te queda cómodo, subí la meta para seguir creciendo.';
      default:
        return 'Vas alineado al plan. Mantené el ritmo antes de agregar metas nuevas.';
    }
  }

  /** Consejo accionable sobre la meta más floja del programa. */
  complianceFocusAdvice(): string {
    const focus = this.complianceFocus();
    if (!focus) return '';
    if (focus.status === 'pending') {
      return `Todavía no cargaste la realidad de ${focus.metricLabel} en ${focus.periodId}. Sin dato no hay diagnóstico posible.`;
    }
    if (focus.goalLabel === 'Tope máximo') {
      return `Te pasaste del tope: ${focus.actualLabel} contra un límite de ${focus.planLabel}. Bajarlo es la palanca más rápida del programa.`;
    }
    return `Vas al ${focus.pctLabel} de la meta: ${focus.actualLabel} contra ${focus.planLabel}. Recortá esa brecha antes de sumar objetivos nuevos.`;
  }

  openBuilder(): void {
    this.tab.set('builder');
    const uid = this.userId();
    if (!uid) return;
    // Al volver a Programa, forzar historial por si el primer paint llegó vacío.
    void this.ensureProgramsLoaded(uid, this.bootstrapSeq, true);
  }

  openHistory(): void {
    this.tab.set('history');
    const uid = this.userId();
    if (uid) void this.refreshHistory(uid);
  }

  roundPct(value: number): number {
    return Math.round(value);
  }

  async selectActiveProgram(item: TargetProgramHistoryItemView): Promise<void> {
    const uid = this.userId();
    if (!uid) return;
    if (this.program()?.programId === item.programId) return;

    this.error.set(null);
    try {
      const evo = await this.objectives.getEvolutionOnce(uid, item.programId);
      this.evolution.set(evo);
      this.program.set(programFromHistoryAndEvolution(item, evo));
      this.execMetricId = this.program()?.targets[0]?.metricTypeId ?? '';
      this.execPeriodId =
        item.cadence === 'monthly' ? currentMonthPeriodId() : currentIsoWeekPeriodId();
    } catch (err) {
      this.error.set(extractGraphqlErrorMessage(err) || 'No se pudo abrir el programa.');
    }
  }

  async closeActiveProgram(): Promise<void> {
    const uid = this.userId();
    const prog = this.program();
    if (!uid || !prog || prog.status !== 'active') return;

    this.saving.set(true);
    this.error.set(null);
    try {
      await this.objectives.closeProgramOnce({
        userId: uid,
        programId: prog.programId,
      });
      this.objectives.removeCachedProgram(uid, prog.programId);
      this.cachedPrograms.set(this.objectives.readCachedPrograms(uid));
      this.program.set(null);
      this.evolution.set(null);
      this.title = 'Mi programa de objetivos';
      this.draftTargets.set([]);
      await this.refreshHistory(uid);
      const remaining = this.activePrograms();
      if (remaining[0]) {
        await this.selectActiveProgram(remaining[0]);
        this.tab.set('builder');
      } else {
        this.tab.set('history');
      }
      this.dataChanged.emit();
    } catch (err) {
      this.error.set(extractGraphqlErrorMessage(err) || 'No se pudo cerrar el programa.');
    } finally {
      this.saving.set(false);
    }
  }

  async inspectHistoryItem(item: TargetProgramHistoryItemView): Promise<void> {
    const uid = this.userId();
    if (!uid) return;
    this.error.set(null);
    try {
      await this.refreshEvolution(uid, item.programId);
      this.tab.set('compliance');
    } catch (err) {
      this.error.set(extractGraphqlErrorMessage(err) || 'No se pudo abrir el cumplimiento.');
    }
  }

  async saveProgram(): Promise<void> {
    const uid = this.userId();
    if (!uid) return;

    const periodId = this.draftPeriodId();
    const targets = this.draftTargets()
      .filter((r) => r.metricTypeId && r.plannedValue != null && r.plannedValue >= 0)
      .map((r) => ({
        metricTypeId: r.metricTypeId,
        periodId,
        plannedValue: Number(r.plannedValue),
      }));

    if (!this.title.trim() || !targets.length) {
      this.error.set('Completá título y al menos un parámetro con meta válida.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    try {
      const programId =
        this.programModalMode() === 'edit' ? this.program()?.programId : undefined;
      const saved = await this.objectives.upsertProgramOnce({
        userId: uid,
        programId,
        title: this.title.trim(),
        cadence: this.cadence,
        status: 'active',
        platform: this.platform() ?? undefined,
        startsAt: this.startsAt,
        targets,
      });
      this.program.set(saved);
      this.applyProgramForm(saved);
      this.objectives.upsertCachedProgram(uid, saved);
      this.cachedPrograms.set(this.objectives.readCachedPrograms(uid));
      this.execMetricId = saved.targets[0]?.metricTypeId ?? '';
      await this.refreshEvolution(uid, saved.programId);
      await this.refreshHistory(uid);
      this.dataChanged.emit();
      this.closeModal();
      this.tab.set('builder');
    } catch (err) {
      this.error.set(extractGraphqlErrorMessage(err) || 'No se pudo guardar el programa.');
    } finally {
      this.saving.set(false);
    }
  }

  async saveExecution(): Promise<void> {
    const uid = this.userId();
    const prog = this.program();
    if (!uid || !prog || this.execValue == null) {
      this.error.set('Completá parámetro, período y valor.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    try {
      await this.objectives.upsertExecutionOnce({
        userId: uid,
        programId: prog.programId,
        metricTypeId: this.execMetricId,
        periodId: this.execPeriodId.trim(),
        actualValue: Number(this.execValue),
      });
      this.execValue = null;
      await this.refreshEvolution(uid, prog.programId);
      await this.refreshHistory(uid);
      this.dataChanged.emit();
      this.closeModal();
      this.tab.set('compliance');
    } catch (err) {
      this.error.set(extractGraphqlErrorMessage(err) || 'No se pudo registrar la ejecución.');
    } finally {
      this.saving.set(false);
    }
  }

  private async bootstrap(userId: string, force = false): Promise<void> {
    const seq = ++this.bootstrapSeq;
    this.error.set(null);
    this.loading.set(true);
    this.metrics.set(seedMetricCatalog());

    const peeked = this.objectives.peekHistory(userId);
    if (peeked?.length) this.history.set(peeked);

    const cached = this.objectives.readCachedPrograms(userId);
    this.cachedPrograms.set(cached);
    if (cached[0] && !this.program()) {
      this.program.set(cached[0]);
      this.applyProgramForm(cached[0]);
    }

    // Si ya hay activos en memoria (prefetch), pintar de inmediato.
    if (this.activePrograms().length) {
      this.loading.set(false);
    }

    try {
      await this.ensureProgramsLoaded(userId, seq, force);
    } catch (err) {
      if (seq !== this.bootstrapSeq) return;
      this.error.set(extractGraphqlErrorMessage(err) || 'No se pudo cargar el módulo de objetivos.');
      if (!this.program() && cached[0]) {
        this.program.set(cached[0]);
        this.applyProgramForm(cached[0]);
      }
    } finally {
      if (seq === this.bootstrapSeq) this.loading.set(false);
    }
  }

  /**
   * Carga historial + activo. El historial se aplica siempre (aunque haya otra
   * corrida en curso): antes se descartaba por carrera y los activos solo
   * aparecían al abrir la pestaña Historial.
   */
  private async ensureProgramsLoaded(
    userId: string,
    seq = this.bootstrapSeq,
    force = false,
  ): Promise<void> {
    const history = await this.loadHistoryWithRetry(userId, force);
    if (history) this.history.set(history);

    let active: TargetProgramView | null = null;
    try {
      active = await this.objectives.getActiveProgramOnce(userId);
    } catch (err) {
      if (seq === this.bootstrapSeq) {
        this.error.set(
          extractGraphqlErrorMessage(err) || 'No se pudo leer el programa activo.',
        );
      }
    }

    if (seq !== this.bootstrapSeq) return;

    if (active) {
      this.program.set(active);
      this.applyProgramForm(active);
      this.objectives.upsertCachedProgram(userId, active);
      this.cachedPrograms.set(this.objectives.readCachedPrograms(userId));
      try {
        await this.refreshEvolution(userId, active.programId);
      } catch {
        /* evolución opcional */
      }
      if (seq !== this.bootstrapSeq) return;
    } else if (!this.program()) {
      const fromActiveList = this.activePrograms()[0];
      const fromHistoryAny = [...(history ?? this.history())].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      )[0];
      const fallbackItem = fromActiveList ?? fromHistoryAny;
      if (fallbackItem) {
        await this.selectActiveProgram(fallbackItem);
        if (seq !== this.bootstrapSeq) return;
      } else {
        const cached = this.objectives.readCachedPrograms(userId);
        if (cached[0]) {
          this.program.set(cached[0]);
          this.applyProgramForm(cached[0]);
          this.syncHint.set(
            'Mostrando programas guardados en este dispositivo; la API no devolvió activos.',
          );
        }
      }
    }

    const focused = this.program();
    if (focused) this.objectives.upsertCachedProgram(userId, focused);
    this.cachedPrograms.set(this.objectives.readCachedPrograms(userId));
  }

  private async loadHistoryWithRetry(
    userId: string,
    force = false,
    attempts = 5,
  ): Promise<TargetProgramHistoryItemView[] | null> {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await this.objectives.listHistoryOnce(userId, 20, {
          force: force || i > 0,
        });
      } catch (err) {
        lastErr = err;
        if (i < attempts - 1) {
          await new Promise((r) => setTimeout(r, 400 * (i + 1)));
          this.objectives.invalidateHistory(userId);
        }
      }
    }
    if (!this.error()) {
      this.error.set(
        extractGraphqlErrorMessage(lastErr) ||
          'No se pudo cargar el historial de programas.',
      );
    }
    return null;
  }

  private applyProgramForm(active: TargetProgramView): void {
    this.title = active.title;
    this.cadence = active.cadence === 'monthly' ? 'monthly' : 'weekly';
    this.startsAt = active.startsAt.slice(0, 10);
    this.draftTargets.set(
      active.targets.map((t) => ({
        metricTypeId: t.metricTypeId,
        periodId: t.periodId,
        plannedValue: t.plannedValue,
      })),
    );
    this.execMetricId = active.targets[0]?.metricTypeId ?? '';
    this.execPeriodId =
      active.cadence === 'monthly' ? currentMonthPeriodId() : currentIsoWeekPeriodId();
  }

  private async refreshEvolution(userId: string, programId: string): Promise<void> {
    const evo = await this.objectives.getEvolutionOnce(userId, programId);
    this.evolution.set(evo);
  }

  private async refreshHistory(userId: string): Promise<void> {
    if (!userId) return;
    const history = await this.loadHistoryWithRetry(userId);
    if (history) this.history.set(history);
  }

  /** Arte lateral del modal full-screen (mismo lenguaje que Análisis de partida). */
  modalWingArtUrl(): string {
    const id = this.program()?.programId ?? this.userId() ?? 'obj-modal';
    let seed = 23;
    for (let i = 0; i < id.length; i++) seed = (seed + id.charCodeAt(i) * (i + 5)) % 997;
    if (this.platform() === 'valorant') {
      return valorantMatchesBannerSplashUrl(seed);
    }
    return lolMatchesBannerSplashUrl(seed);
  }

  private lockBody(): void {
    this.document.body.classList.add('sg-obj-modal-lock', 'sg-match-modal-lock');
  }

  private unlockBody(): void {
    this.document.body.classList.remove('sg-obj-modal-lock', 'sg-match-modal-lock');
  }
}

function seedMetricCatalog(): ObjectiveMetricTypeView[] {
  return OBJECTIVE_METRIC_TYPES.map((m) => ({
    id: m.id,
    label: m.label,
    unit: m.unit,
    description: m.description,
    higherIsBetter: m.higherIsBetter,
    goalKind: m.goalKind,
    aggregation: m.aggregation,
    domain: m.domain,
    autoSource: m.autoSource,
  }));
}

function historyItemFromProgram(program: TargetProgramView): TargetProgramHistoryItemView {
  return {
    programId: program.programId,
    userId: program.userId,
    title: program.title,
    cadence: program.cadence,
    status: program.status,
    platform: program.platform,
    startsAt: program.startsAt,
    endsAt: program.endsAt,
    createdAt: program.createdAt,
    updatedAt: program.updatedAt,
    targetCount: program.targets.length,
    executionCount: 0,
    globalCompliancePct: null,
    outcome: 'in_progress',
    outcomeLabel: 'En curso',
    isActive: true,
  };
}

function programFromHistoryAndEvolution(
  item: TargetProgramHistoryItemView,
  evo: ObjectiveEvolutionView | null,
): TargetProgramView {
  const seen = new Set<string>();
  const targets = (evo?.rows ?? [])
    .filter((row) => {
      const key = `${row.metricTypeId}#${row.periodId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((row) => ({
      programId: item.programId,
      metricTypeId: row.metricTypeId,
      periodId: row.periodId,
      plannedValue: row.plannedValue,
      createdAt: item.createdAt,
    }));

  return {
    programId: item.programId,
    userId: item.userId,
    title: item.title,
    cadence: item.cadence,
    status: item.status,
    platform: item.platform,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    targets,
  };
}
