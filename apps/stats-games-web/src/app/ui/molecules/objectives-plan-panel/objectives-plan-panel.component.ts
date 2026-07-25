import { DOCUMENT } from '@angular/common';
import {
  Component,
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
  StatsComparisonChartComponent,
  type StatsComparisonRow,
} from '../stats-comparison-chart/stats-comparison-chart.component';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';
import { extractGraphqlErrorMessage } from '../../../utils/graphql-error.util';
import { sgFadeSlideIn, sgModalIn } from '../../animations/sg-motion';

type ObjTab = 'builder' | 'reality' | 'evolution' | 'history';
type HistoryFilter = 'all' | 'in_progress' | 'fulfilled' | 'not_fulfilled';
type ModalKind = 'program' | 'execution' | null;

interface DraftTargetRow {
  metricTypeId: string;
  periodId: string;
  plannedValue: number | null;
}

@Component({
  standalone: true,
  selector: 'sg-objectives-plan-panel',
  encapsulation: ViewEncapsulation.None,
  imports: [FormsModule, StatsComparisonChartComponent, NeonBadgeComponent],
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
            (click)="tab.set('builder')"
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
            [class.sg-obj-panel__tab--active]="tab() === 'evolution'"
            [attr.aria-selected]="tab() === 'evolution'"
            (click)="tab.set('evolution')"
          >
            Evolución
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
          @if (program(); as p) {
            <article class="sg-obj-summary">
              <div class="sg-obj-summary__top">
                <div>
                  <h3 class="sg-obj-summary__title">{{ p.title }}</h3>
                  <p class="sg-obj-summary__meta u-m-0">
                    {{ p.cadence === 'monthly' ? 'Mensual' : 'Semanal' }}
                    · desde {{ p.startsAt.slice(0, 10) }}
                    · {{ p.targets.length }} parámetros
                  </p>
                </div>
                <sg-neon-badge tone="cyan">En curso</sg-neon-badge>
              </div>
              <ul class="sg-obj-summary__targets">
                @for (t of p.targets; track t.metricTypeId + t.periodId) {
                  <li>
                    <strong>{{ metricLabel(t.metricTypeId) }}</strong>
                    <span>{{ t.periodId }} · meta {{ t.plannedValue }} {{ metricUnit(t.metricTypeId) }}</span>
                  </li>
                }
              </ul>
              <div class="sg-obj-actions">
                <button type="button" class="u-btn u-btn--gold" (click)="openProgramModal('edit')">
                  Editar programa
                </button>
                <button type="button" class="u-btn u-btn--ghost" (click)="openProgramModal('create')">
                  Nuevo programa
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
            </article>
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
              Registrá la ejecución real del período (victorias, derrotas, kills, etc.).
            </p>
            <div class="sg-obj-actions">
              <button type="button" class="u-btn u-btn--gold" (click)="openExecutionModal()">
                Registrar ejecución
              </button>
            </div>
          }
        </div>
      }

      @if (tab() === 'evolution') {
        <div class="sg-obj-panel__body" role="tabpanel">
          @if (!evolution()) {
            <p class="sg-obj-empty u-m-0">
              Sin datos de evolución. Definí metas y cargá al menos una ejecución.
            </p>
          } @else {
            <div class="sg-obj-kpis" aria-label="KPIs de cumplimiento">
              <article class="sg-obj-kpi">
                <span class="sg-obj-kpi__value">
                  {{
                    evolution()!.globalCompliancePct != null
                      ? evolution()!.globalCompliancePct + '%'
                      : '—'
                  }}
                </span>
                <span class="sg-obj-kpi__label">Cumplimiento global</span>
              </article>
              <article class="sg-obj-kpi sg-obj-kpi--ok">
                <span class="sg-obj-kpi__value">{{ evolution()!.alignedCount }}</span>
                <span class="sg-obj-kpi__label">Alineados</span>
              </article>
              <article class="sg-obj-kpi sg-obj-kpi--warn">
                <span class="sg-obj-kpi__value">{{ evolution()!.aboveCount }}</span>
                <span class="sg-obj-kpi__label">Por encima</span>
              </article>
              <article class="sg-obj-kpi sg-obj-kpi--danger">
                <span class="sg-obj-kpi__value">{{ evolution()!.criticalCount }}</span>
                <span class="sg-obj-kpi__label">Críticos</span>
              </article>
            </div>

            <sg-stats-comparison-chart
              title="Plan vs Real por métrica"
              subtitle="Barras: meta planificada vs ejecución acumulada."
              youLabel="Real"
              benchmarkLabel="Plan"
              [rows]="chartRows()"
            />

            <div class="sg-obj-table-wrap">
              <table class="sg-obj-table">
                <thead>
                  <tr>
                    <th>Métrica</th>
                    <th>Período</th>
                    <th>Plan</th>
                    <th>Real</th>
                    <th>%</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of evolution()!.rows; track row.metricTypeId + row.periodId) {
                    <tr [attr.data-status]="row.status">
                      <td>{{ row.metricLabel }}</td>
                      <td>{{ row.periodId }}</td>
                      <td>{{ row.plannedValue }} {{ row.unit }}</td>
                      <td>{{ row.actualValue ?? '—' }}</td>
                      <td>{{ row.compliancePct != null ? row.compliancePct + '%' : '—' }}</td>
                      <td>
                        <sg-neon-badge [tone]="statusTone(row.status)">
                          {{ row.statusLabel }}
                        </sg-neon-badge>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
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
              Todos ({{ history().length }})
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
                      Ver evolución
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
      <div class="sg-obj-modal" role="presentation" (click)="closeModal()" @sgFadeSlideIn>
        <div
          class="sg-obj-modal__dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sg-obj-modal-program-title"
          (click)="$event.stopPropagation()"
          @sgModalIn
        >
          <header class="sg-obj-modal__header">
            <div>
              <p class="sg-obj-modal__eyebrow">Programa</p>
              <h3 id="sg-obj-modal-program-title" class="sg-obj-modal__title">
                {{ programModalMode() === 'create' ? 'Nuevo programa' : 'Editar programa' }}
              </h3>
              <p class="sg-obj-modal__subtitle u-m-0">
                Elegí parámetros: victorias, derrotas, KDA, win rate, farm y más.
              </p>
            </div>
            <button type="button" class="sg-obj-modal__close" aria-label="Cerrar" (click)="closeModal()">
              ×
            </button>
          </header>

          <div class="sg-obj-modal__body">
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
                <h4 class="sg-obj-targets__title">Parámetros / metas</h4>
                <button type="button" class="u-btn u-btn--ghost" (click)="addTargetRow()">
                  + Parámetro
                </button>
              </div>

              @for (row of draftTargets(); track i; let i = $index) {
                <div class="sg-obj-target-row sg-obj-target-row--modal">
                  <select [(ngModel)]="row.metricTypeId" [attr.aria-label]="'Parámetro ' + (i + 1)">
                    <optgroup label="Competitivo">
                      @for (m of competitiveMetrics(); track m.id) {
                        <option [value]="m.id">{{ m.label }} ({{ m.unit }})</option>
                      }
                    </optgroup>
                    <optgroup label="Atleta / hábitos">
                      @for (m of athleteMetrics(); track m.id) {
                        <option [value]="m.id">{{ m.label }} ({{ m.unit }})</option>
                      }
                    </optgroup>
                  </select>
                  <input
                    type="text"
                    [(ngModel)]="row.periodId"
                    [attr.aria-label]="'Período ' + (i + 1)"
                    placeholder="2026-W30"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    [(ngModel)]="row.plannedValue"
                    [attr.aria-label]="'Meta ' + (i + 1)"
                    placeholder="Meta"
                  />
                  <button
                    type="button"
                    class="sg-obj-target-row__remove"
                    (click)="removeTargetRow(i)"
                    aria-label="Quitar parámetro"
                  >
                    ✕
                  </button>
                </div>
              }
            </div>
          </div>

          <footer class="sg-obj-modal__footer">
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

  readonly userId = input.required<string>();
  readonly platform = input<string | null>(null);
  readonly dataChanged = output<void>();

  readonly tab = signal<ObjTab>('builder');
  readonly modal = signal<ModalKind>(null);
  readonly programModalMode = signal<'create' | 'edit'>('create');
  readonly metrics = signal<ObjectiveMetricTypeView[]>([]);
  readonly program = signal<TargetProgramView | null>(null);
  readonly evolution = signal<ObjectiveEvolutionView | null>(null);
  readonly history = signal<TargetProgramHistoryItemView[]>([]);
  readonly historyFilter = signal<HistoryFilter>('all');
  readonly draftTargets = signal<DraftTargetRow[]>([]);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  title = 'Mi programa de objetivos';
  cadence: 'weekly' | 'monthly' = 'weekly';
  startsAt = new Date().toISOString().slice(0, 10);
  execMetricId = '';
  execPeriodId = currentIsoWeekPeriodId();
  execValue: number | null = null;

  readonly competitiveMetrics = computed(() =>
    this.metrics().filter((m) => m.domain === 'competitive'),
  );
  readonly athleteMetrics = computed(() =>
    this.metrics().filter((m) => m.domain === 'athlete'),
  );

  readonly programMetrics = computed(() => {
    const ids = this.program()?.targets.map((t) => t.metricTypeId) ?? [];
    return [...new Set(ids)];
  });

  readonly chartRows = computed((): StatsComparisonRow[] => {
    const evo = this.evolution();
    if (!evo) return [];
    return evo.byMetric.map((m) => ({
      label: m.metricLabel,
      you: m.actualTotal,
      benchmark: m.plannedTotal,
    }));
  });

  readonly historyCounts = computed(() => {
    const rows = this.history();
    return {
      in_progress: rows.filter((r) => r.outcome === 'in_progress').length,
      fulfilled: rows.filter((r) => r.outcome === 'fulfilled').length,
      not_fulfilled: rows.filter((r) => r.outcome === 'not_fulfilled').length,
    };
  });

  readonly filteredHistory = computed(() => {
    const filter = this.historyFilter();
    const rows = this.history();
    if (filter === 'all') return rows;
    return rows.filter((r) => r.outcome === filter);
  });

  constructor() {
    effect(() => {
      const uid = this.userId();
      if (!uid) return;
      void this.bootstrap(uid);
    });
  }

  ngOnDestroy(): void {
    this.unlockBody();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.modal()) this.closeModal();
  }

  onCadenceChange(): void {
    const period =
      this.cadence === 'weekly' ? currentIsoWeekPeriodId() : currentMonthPeriodId();
    this.draftTargets.update((rows) => rows.map((r) => ({ ...r, periodId: period })));
    this.execPeriodId = period;
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
    this.unlockBody();
  }

  addTargetRow(preferredMetricId?: string): void {
    const metrics = this.metrics();
    const period =
      this.cadence === 'weekly' ? currentIsoWeekPeriodId() : currentMonthPeriodId();
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
  }

  metricLabel(id: string): string {
    return this.metrics().find((m) => m.id === id)?.label ?? id;
  }

  metricUnit(id: string): string {
    return this.metrics().find((m) => m.id === id)?.unit ?? '';
  }

  statusTone(status: string): 'lime' | 'cyan' | 'purple' | 'pink' | 'muted' | 'gold' {
    if (status === 'aligned') return 'lime';
    if (status === 'above') return 'cyan';
    if (status === 'critical') return 'pink';
    return 'muted';
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

  openHistory(): void {
    this.tab.set('history');
    void this.refreshHistory(this.userId());
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
      this.program.set(null);
      this.evolution.set(null);
      this.title = 'Mi programa de objetivos';
      this.draftTargets.set([]);
      await this.refreshHistory(uid);
      this.dataChanged.emit();
      this.tab.set('history');
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
      this.tab.set('evolution');
    } catch (err) {
      this.error.set(extractGraphqlErrorMessage(err) || 'No se pudo abrir la evolución.');
    }
  }

  async saveProgram(): Promise<void> {
    const uid = this.userId();
    if (!uid) return;

    const targets = this.draftTargets()
      .filter((r) => r.metricTypeId && r.periodId && r.plannedValue != null && r.plannedValue >= 0)
      .map((r) => ({
        metricTypeId: r.metricTypeId,
        periodId: r.periodId.trim(),
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
      this.execMetricId = saved.targets[0]?.metricTypeId ?? '';
      await this.refreshEvolution(uid, saved.programId);
      await this.refreshHistory(uid);
      this.dataChanged.emit();
      this.closeModal();
      this.tab.set('reality');
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
      this.tab.set('evolution');
    } catch (err) {
      this.error.set(extractGraphqlErrorMessage(err) || 'No se pudo registrar la ejecución.');
    } finally {
      this.saving.set(false);
    }
  }

  private async bootstrap(userId: string): Promise<void> {
    this.error.set(null);
    try {
      const [metricTypes, active] = await Promise.all([
        this.objectives.listMetricTypesOnce(),
        this.objectives.getActiveProgramOnce(userId),
      ]);
      this.metrics.set(metricTypes);
      this.program.set(active);
      await this.refreshHistory(userId);

      if (active) {
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
        await this.refreshEvolution(userId, active.programId);
      }
    } catch (err) {
      this.error.set(extractGraphqlErrorMessage(err) || 'No se pudo cargar el módulo de objetivos.');
    }
  }

  private async refreshEvolution(userId: string, programId: string): Promise<void> {
    const evo = await this.objectives.getEvolutionOnce(userId, programId);
    this.evolution.set(evo);
  }

  private async refreshHistory(userId: string): Promise<void> {
    if (!userId) return;
    try {
      this.history.set(await this.objectives.listHistoryOnce(userId));
    } catch {
      /* historial opcional si el schema aún no está deployado */
    }
  }

  private lockBody(): void {
    this.document.body.classList.add('sg-obj-modal-lock');
  }

  private unlockBody(): void {
    this.document.body.classList.remove('sg-obj-modal-lock');
  }
}
