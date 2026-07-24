import {
  getObjectiveMetricType,
  isObjectiveMetricTypeId,
} from '@stats-games/common';
import type {
  ActualExecutionDto,
  ObjectiveAlignment,
  ObjectiveEvolutionDto,
  ObjectiveEvolutionRowDto,
  ProgramTargetDto,
  TargetProgramDto,
} from '../../dto/objectives/objectives.dto';

/** Umbrales de alineación (cumplimiento = real/meta * 100). */
const ALIGNED_MIN = 90;
const ALIGNED_MAX = 115;

export function computeCompliancePct(actual: number, planned: number): number | null {
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
    const actual = execMap.get(`${t.metricTypeId}#${t.periodId}`) ?? null;
    const compliancePct =
      actual == null ? null : computeCompliancePct(actual, t.plannedValue);
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
    const metricRows = rows.filter((r) => r.metricTypeId === metricTypeId);
    const plannedTotal = metricRows.reduce((s, r) => s + r.plannedValue, 0);
    const actualTotal = metricRows.reduce((s, r) => s + (r.actualValue ?? 0), 0);
    const compliancePct = computeCompliancePct(actualTotal, plannedTotal);
    const { status, statusLabel } = classifyAlignment(
      metricRows.every((r) => r.actualValue == null) ? null : compliancePct,
    );
    const meta = getObjectiveMetricType(metricTypeId);
    return {
      metricTypeId,
      metricLabel: meta?.label ?? metricTypeId,
      unit: meta?.unit ?? '',
      plannedTotal,
      actualTotal,
      compliancePct: metricRows.every((r) => r.actualValue == null) ? null : compliancePct,
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
