import {
  getObjectiveMetricType,
  isObjectiveMetricTypeId,
  type ObjectiveAggregation,
  type ObjectiveGoalKind,
} from '@stats-games/common';
import type {
  ActualExecutionDto,
  ObjectiveAlignment,
  ObjectiveEvolutionDto,
  ObjectiveEvolutionRowDto,
  ProgramOutcome,
  ProgramTargetDto,
  TargetProgramDto,
} from '../../dto/objectives/objectives.dto';

/** Umbrales de alineación (cumplimiento relativo a la meta). */
const ALIGNED_MIN = 90;
const ALIGNED_MAX = 115;
/** Programa cerrado se considera cumplido desde este % global. */
const PROGRAM_FULFILLED_MIN = 90;

/**
 * Cumplimiento según tipo de meta:
 * - at_least: actual / planned (más = mejor)
 * - at_most:  planned / actual (menos = mejor; 0 actual = overachieve)
 */
export function computeCompliancePct(
  actual: number,
  planned: number,
  goalKind: ObjectiveGoalKind = 'at_least',
): number | null {
  if (planned < 0) return null;

  if (goalKind === 'at_most') {
    if (planned === 0) {
      return actual <= 0 ? 100 : 0;
    }
    if (actual <= 0) return 200;
    return Math.round((planned / actual) * 1000) / 10;
  }

  if (planned <= 0) return null;
  return Math.round((actual / planned) * 1000) / 10;
}

export function classifyAlignment(compliancePct: number | null): {
  status: ObjectiveAlignment;
  statusLabel: string;
} {
  if (compliancePct == null) {
    return { status: 'critical', statusLabel: 'Sin dato' };
  }
  if (compliancePct < ALIGNED_MIN) {
    return { status: 'critical', statusLabel: 'Crítico / Por debajo' };
  }
  if (compliancePct > ALIGNED_MAX) {
    return { status: 'above', statusLabel: 'Por encima' };
  }
  return { status: 'aligned', statusLabel: 'Alineado' };
}

function periodSortKey(periodId: string): string {
  return periodId;
}

function aggregateValues(
  values: number[],
  aggregation: ObjectiveAggregation,
): number {
  if (!values.length) return 0;
  switch (aggregation) {
    case 'avg':
      return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
    case 'max':
      return Math.max(...values);
    case 'last':
      return values[values.length - 1] ?? 0;
    case 'sum':
    default:
      return Math.round(values.reduce((s, v) => s + v, 0) * 10) / 10;
  }
}

export function buildObjectiveEvolution(input: {
  program: Omit<TargetProgramDto, 'targets'>;
  targets: ProgramTargetDto[];
  executions: ActualExecutionDto[];
}): ObjectiveEvolutionDto {
  const execMap = new Map(
    input.executions.map((e) => [`${e.metricTypeId}#${e.periodId}`, e.actualValue]),
  );

  const rows: ObjectiveEvolutionRowDto[] = input.targets.map((t) => {
    const meta = getObjectiveMetricType(t.metricTypeId);
    const goalKind: ObjectiveGoalKind = meta?.goalKind ?? 'at_least';
    const actual = execMap.get(`${t.metricTypeId}#${t.periodId}`) ?? null;
    const compliancePct =
      actual == null ? null : computeCompliancePct(actual, t.plannedValue, goalKind);
    const deviationPct =
      compliancePct == null ? null : Math.round((compliancePct - 100) * 10) / 10;
    const { status, statusLabel } = classifyAlignment(compliancePct);

    return {
      metricTypeId: t.metricTypeId,
      metricLabel: meta?.label ?? t.metricTypeId,
      unit: meta?.unit ?? '',
      periodId: t.periodId,
      plannedValue: t.plannedValue,
      actualValue: actual,
      compliancePct,
      deviationPct,
      status,
      statusLabel,
    };
  });

  const withActual = rows.filter((r) => r.compliancePct != null);
  const globalCompliancePct =
    withActual.length === 0
      ? null
      : Math.round(
          (withActual.reduce((sum, r) => sum + (r.compliancePct ?? 0), 0) / withActual.length) *
            10,
        ) / 10;

  const metricIds = [...new Set(input.targets.map((t) => t.metricTypeId))];
  const byMetric = metricIds.map((metricTypeId) => {
    const meta = getObjectiveMetricType(metricTypeId);
    const aggregation: ObjectiveAggregation = meta?.aggregation ?? 'sum';
    const goalKind: ObjectiveGoalKind = meta?.goalKind ?? 'at_least';

    const metricRows = [...rows.filter((r) => r.metricTypeId === metricTypeId)].sort(
      (a, b) => periodSortKey(a.periodId).localeCompare(periodSortKey(b.periodId)),
    );

    const plannedValues = metricRows.map((r) => r.plannedValue);
    const actualValues = metricRows
      .filter((r) => r.actualValue != null)
      .map((r) => r.actualValue as number);

    const plannedTotal = aggregateValues(plannedValues, aggregation);
    const actualTotal = actualValues.length
      ? aggregateValues(actualValues, aggregation)
      : 0;
    const allMissing = metricRows.every((r) => r.actualValue == null);
    const compliancePct = allMissing
      ? null
      : computeCompliancePct(actualTotal, plannedTotal, goalKind);
    const { status, statusLabel } = classifyAlignment(compliancePct);

    return {
      metricTypeId,
      metricLabel: meta?.label ?? metricTypeId,
      unit: meta?.unit ?? '',
      plannedTotal,
      actualTotal,
      compliancePct,
      status,
      statusLabel,
    };
  });

  return {
    programId: input.program.programId,
    userId: input.program.userId,
    title: input.program.title,
    cadence: input.program.cadence,
    globalCompliancePct,
    alignedCount: rows.filter((r) => r.status === 'aligned').length,
    aboveCount: rows.filter((r) => r.status === 'above').length,
    criticalCount: rows.filter((r) => r.status === 'critical').length,
    rows,
    byMetric,
  };
}

export function assertValidMetricTypeIds(ids: string[]): void {
  const invalid = ids.filter((id) => !isObjectiveMetricTypeId(id));
  if (invalid.length) {
    throw new Error(`metricTypeId inválido: ${invalid.join(', ')}`);
  }
}

export function classifyProgramOutcome(input: {
  status: TargetProgramDto['status'];
  globalCompliancePct: number | null;
}): { outcome: ProgramOutcome; outcomeLabel: string } {
  if (input.status === 'active' || input.status === 'draft') {
    return { outcome: 'in_progress', outcomeLabel: 'En curso' };
  }

  const pct = input.globalCompliancePct;
  if (pct != null && pct >= PROGRAM_FULFILLED_MIN) {
    return { outcome: 'fulfilled', outcomeLabel: 'Cumplido' };
  }
  return { outcome: 'not_fulfilled', outcomeLabel: 'No cumplido' };
}
