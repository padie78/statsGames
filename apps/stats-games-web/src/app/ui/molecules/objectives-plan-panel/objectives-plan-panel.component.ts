import {
  Component,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ObjectivesService,
  currentIsoWeekPeriodId,
  currentMonthPeriodId,
  type ObjectiveEvolutionView,
  type ObjectiveMetricTypeView,
  type TargetProgramView,
} from '../../../services/objectives.service';
import {
  StatsComparisonChartComponent,
  type StatsComparisonRow,
} from '../stats-comparison-chart/stats-comparison-chart.component';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';
import { extractGraphqlErrorMessage } from '../../../utils/graphql-error.util';

type ObjTab = 'builder' | 'reality' | 'evolution';

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
        </div>
      </header>

      @if (error()) {
        <p class="u-error u-m-0">{{ error() }}</p>
      }

      @if (tab() === 'builder') {
        <div class="sg-obj-panel__body" role="tabpanel">
          <label class="sg-obj-field">
            <span>Título del programa</span>
            <input type="text" [(ngModel)]="title" placeholder="Ej. Prep temporada Q3" />
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
              <h3 class="sg-obj-targets__title">Metas por métrica</h3>
              <button type="button" class="u-btn u-btn--ghost" (click)="addTargetRow()">
                + Métrica
              </button>
            </div>

            @for (row of draftTargets(); track i; let i = $index) {
              <div class="sg-obj-target-row">
                <select [(ngModel)]="row.metricTypeId">
                  @for (m of metrics(); track m.id) {
                    <option [value]="m.id">{{ m.label }} ({{ m.unit }})</option>
                  }
                </select>
                <input type="text" [(ngModel)]="row.periodId" [attr.aria-label]="'Período ' + (i + 1)" />
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  [(ngModel)]="row.plannedValue"
                  placeholder="Meta"
                />
                <button type="button" class="sg-obj-target-row__remove" (click)="removeTargetRow(i)">
                  ✕
                </button>
              </div>
            }
          </div>

          <div class="sg-obj-actions">
            <button
              type="button"
              class="u-btn u-btn--gold"
              [disabled]="saving()"
              (click)="saveProgram()"
            >
              {{ saving() ? 'Guardando…' : 'Guardar programa activo' }}
            </button>
            @if (program(); as p) {
              <span class="sg-obj-hint">Activo: {{ p.title }} · {{ p.targets.length }} metas</span>
            }
          </div>
        </div>
      }

      @if (tab() === 'reality') {
        <div class="sg-obj-panel__body" role="tabpanel">
          @if (!program()) {
            <p class="sg-obj-empty u-m-0">Creá un programa activo antes de cargar realidad.</p>
          } @else {
            <div class="sg-obj-row">
              <label class="sg-obj-field">
                <span>Métrica</span>
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
            <div class="sg-obj-actions">
              <button
                type="button"
                class="u-btn u-btn--gold"
                [disabled]="saving()"
                (click)="saveExecution()"
              >
                {{ saving() ? 'Guardando…' : 'Registrar ejecución' }}
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
                  {{ evolution()!.globalCompliancePct != null ? evolution()!.globalCompliancePct + '%' : '—' }}
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
    </section>
  `,
})
export class ObjectivesPlanPanelComponent {
  private readonly objectives = inject(ObjectivesService);

  readonly userId = input.required<string>();
  readonly platform = input<string | null>(null);

  readonly tab = signal<ObjTab>('builder');
  readonly metrics = signal<ObjectiveMetricTypeView[]>([]);
  readonly program = signal<TargetProgramView | null>(null);
  readonly evolution = signal<ObjectiveEvolutionView | null>(null);
  readonly draftTargets = signal<DraftTargetRow[]>([]);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  title = 'Mi programa de objetivos';
  cadence: 'weekly' | 'monthly' = 'weekly';
  startsAt = new Date().toISOString().slice(0, 10);
  execMetricId = '';
  execPeriodId = currentIsoWeekPeriodId();
  execValue: number | null = null;

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

  constructor() {
    effect(() => {
      const uid = this.userId();
      if (!uid) return;
      void this.bootstrap(uid);
    });
  }

  onCadenceChange(): void {
    const period =
      this.cadence === 'weekly' ? currentIsoWeekPeriodId() : currentMonthPeriodId();
    this.draftTargets.update((rows) => rows.map((r) => ({ ...r, periodId: period })));
    this.execPeriodId = period;
  }

  addTargetRow(): void {
    const metrics = this.metrics();
    const period =
      this.cadence === 'weekly' ? currentIsoWeekPeriodId() : currentMonthPeriodId();
    this.draftTargets.update((rows) => [
      ...rows,
      {
        metricTypeId: metrics[0]?.id ?? 'training_hours',
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

  statusTone(status: string): 'lime' | 'cyan' | 'purple' | 'pink' | 'muted' | 'gold' {
    if (status === 'aligned') return 'lime';
    if (status === 'above') return 'cyan';
    if (status === 'critical') return 'pink';
    return 'muted';
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
      this.error.set('Completá título y al menos una meta válida.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    try {
      const saved = await this.objectives.upsertProgramOnce({
        userId: uid,
        programId: this.program()?.programId,
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
      this.error.set('Completá métrica, período y valor.');
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
      } else if (!this.draftTargets().length) {
        this.addTargetRow();
      }
    } catch (err) {
      this.error.set(extractGraphqlErrorMessage(err) || 'No se pudo cargar el módulo de objetivos.');
      if (!this.draftTargets().length) this.addTargetRow();
    }
  }

  private async refreshEvolution(userId: string, programId: string): Promise<void> {
    const evo = await this.objectives.getEvolutionOnce(userId, programId);
    this.evolution.set(evo);
  }
}
