import { Injectable } from '@angular/core';
import { OBJECTIVE_METRIC_TYPES } from '@stats-games/common';
import { generateClient } from 'aws-amplify/api';
import { firstValueFrom, from, map } from 'rxjs';

export interface ObjectiveMetricTypeView {
  id: string;
  label: string;
  unit: string;
  description: string;
  higherIsBetter: boolean;
  goalKind: 'at_least' | 'at_most' | string;
  aggregation: 'sum' | 'avg' | 'max' | 'last' | string;
  domain: string;
  autoSource?: string | null;
}

export interface ProgramTargetView {
  programId: string;
  metricTypeId: string;
  periodId: string;
  plannedValue: number;
  notes?: string | null;
  createdAt: string;
}

export interface TargetProgramView {
  programId: string;
  userId: string;
  title: string;
  cadence: 'weekly' | 'monthly' | string;
  status: string;
  platform?: string | null;
  startsAt: string;
  endsAt?: string | null;
  createdAt: string;
  updatedAt: string;
  targets: ProgramTargetView[];
}

export interface ActualExecutionView {
  programId: string;
  userId: string;
  metricTypeId: string;
  periodId: string;
  actualValue: number;
  recordedAt: string;
  source: string;
  notes?: string | null;
}

export interface ObjectiveEvolutionRowView {
  metricTypeId: string;
  metricLabel: string;
  unit: string;
  periodId: string;
  plannedValue: number;
  actualValue?: number | null;
  compliancePct?: number | null;
  deviationPct?: number | null;
  status: 'aligned' | 'above' | 'critical' | string;
  statusLabel: string;
}

export interface ObjectiveEvolutionView {
  programId: string;
  userId: string;
  title: string;
  cadence: string;
  globalCompliancePct?: number | null;
  alignedCount: number;
  aboveCount: number;
  criticalCount: number;
  rows: ObjectiveEvolutionRowView[];
  byMetric: Array<{
    metricTypeId: string;
    metricLabel: string;
    unit: string;
    plannedTotal: number;
    actualTotal: number;
    compliancePct?: number | null;
    status: string;
    statusLabel: string;
  }>;
}

export type ProgramOutcomeView = 'in_progress' | 'fulfilled' | 'not_fulfilled' | string;

export interface SyncObjectiveActualsResultView {
  programId: string;
  periodId: string;
  matchCount: number;
  synced: Array<{
    metricTypeId: string;
    periodId: string;
    actualValue: number;
    source: string;
  }>;
  skipped: Array<{ metricTypeId: string; reason: string }>;
}

export interface TargetProgramHistoryItemView {
  programId: string;
  userId: string;
  title: string;
  cadence: string;
  status: string;
  platform?: string | null;
  startsAt: string;
  endsAt?: string | null;
  createdAt: string;
  updatedAt: string;
  targetCount: number;
  executionCount: number;
  globalCompliancePct?: number | null;
  outcome: ProgramOutcomeView;
  outcomeLabel: string;
  isActive: boolean;
}

/**
 * El catálogo es data de compilación (`libs/common`): no depende del deploy de
 * AppSync, así el selector de parámetros siempre tiene opciones.
 */
const LOCAL_METRIC_TYPES: readonly ObjectiveMetricTypeView[] = OBJECTIVE_METRIC_TYPES.map(
  (m) => ({
    id: m.id,
    label: m.label,
    unit: m.unit,
    description: m.description,
    higherIsBetter: m.higherIsBetter,
    goalKind: m.goalKind,
    aggregation: m.aggregation,
    domain: m.domain,
    autoSource: m.autoSource,
  }),
);

const PROGRAM_FIELDS = /* GraphQL */ `
  programId
  userId
  title
  cadence
  status
  platform
  startsAt
  endsAt
  createdAt
  updatedAt
  targets {
    programId
    metricTypeId
    periodId
    plannedValue
    notes
    createdAt
  }
`;

const EVOLUTION_FIELDS = /* GraphQL */ `
  programId
  userId
  title
  cadence
  globalCompliancePct
  alignedCount
  aboveCount
  criticalCount
  rows {
    metricTypeId
    metricLabel
    unit
    periodId
    plannedValue
    actualValue
    compliancePct
    deviationPct
    status
    statusLabel
  }
  byMetric {
    metricTypeId
    metricLabel
    unit
    plannedTotal
    actualTotal
    compliancePct
    status
    statusLabel
  }
`;

@Injectable({ providedIn: 'root' })
export class ObjectivesService {
  private readonly client = generateClient();

  listMetricTypesOnce(): Promise<ObjectiveMetricTypeView[]> {
    return Promise.resolve(LOCAL_METRIC_TYPES.map((m) => ({ ...m })));
  }

  getActiveProgramOnce(userId: string): Promise<TargetProgramView | null> {
    return firstValueFrom(
      from(
        this.client.graphql({
          query: /* GraphQL */ `
            query GetActiveTargetProgram($userId: ID!) {
              getActiveTargetProgram(userId: $userId) { ${PROGRAM_FIELDS} }
            }
          `,
          variables: { userId },
        }),
      ).pipe(
        map(
          (resp) =>
            (resp as { data: { getActiveTargetProgram: TargetProgramView | null } }).data
              .getActiveTargetProgram,
        ),
      ),
    );
  }

  getEvolutionOnce(userId: string, programId?: string): Promise<ObjectiveEvolutionView | null> {
    return firstValueFrom(
      from(
        this.client.graphql({
          query: /* GraphQL */ `
            query GetObjectiveEvolution($userId: ID!, $programId: ID) {
              getObjectiveEvolution(userId: $userId, programId: $programId) {
                ${EVOLUTION_FIELDS}
              }
            }
          `,
          variables: { userId, programId: programId ?? null },
        }),
      ).pipe(
        map(
          (resp) =>
            (resp as { data: { getObjectiveEvolution: ObjectiveEvolutionView | null } }).data
              .getObjectiveEvolution,
        ),
      ),
    );
  }

  listHistoryOnce(userId: string, limit = 20): Promise<TargetProgramHistoryItemView[]> {
    const mapRows = (rows: Array<Partial<TargetProgramHistoryItemView> & { programId: string }>) =>
      (rows ?? []).map((row) => ({
        programId: row.programId,
        userId: row.userId ?? userId,
        title: row.title ?? '',
        cadence: row.cadence ?? 'weekly',
        status: row.status ?? 'archived',
        platform: row.platform,
        startsAt: row.startsAt ?? '',
        endsAt: row.endsAt,
        createdAt: row.createdAt ?? '',
        updatedAt: row.updatedAt ?? '',
        targetCount: row.targetCount ?? 0,
        executionCount: row.executionCount ?? 0,
        globalCompliancePct: row.globalCompliancePct,
        outcome: row.outcome ?? 'in_progress',
        outcomeLabel: row.outcomeLabel ?? 'En curso',
        isActive: Boolean(row.isActive),
      }));

    const run = (withIsActive: boolean) =>
      firstValueFrom(
        from(
          this.client.graphql({
            query: /* GraphQL */ `
              query ListTargetProgramHistory($userId: ID!, $limit: Int) {
                listTargetProgramHistory(userId: $userId, limit: $limit) {
                  programId
                  userId
                  title
                  cadence
                  status
                  platform
                  startsAt
                  endsAt
                  createdAt
                  updatedAt
                  targetCount
                  executionCount
                  globalCompliancePct
                  outcome
                  outcomeLabel
                  ${withIsActive ? 'isActive' : ''}
                }
              }
            `,
            variables: { userId, limit },
          }),
        ).pipe(
          map((resp) =>
            mapRows(
              (resp as { data: { listTargetProgramHistory: TargetProgramHistoryItemView[] } }).data
                .listTargetProgramHistory,
            ),
          ),
        ),
      );

    return run(true).catch(() => run(false));
  }

  /** Caché local para no perder la UI si AppSync falla al refrescar. */
  readCachedPrograms(userId: string): TargetProgramView[] {
    try {
      const raw = localStorage.getItem(cacheKey(userId));
      if (!raw) return [];
      const parsed = JSON.parse(raw) as TargetProgramView[];
      return Array.isArray(parsed) ? parsed.filter((p) => p?.programId && p.status === 'active') : [];
    } catch {
      return [];
    }
  }

  writeCachedPrograms(userId: string, programs: TargetProgramView[]): void {
    try {
      const actives = programs.filter((p) => p.status === 'active');
      localStorage.setItem(cacheKey(userId), JSON.stringify(actives));
    } catch {
      /* ignore quota / private mode */
    }
  }

  upsertCachedProgram(userId: string, program: TargetProgramView): void {
    const current = this.readCachedPrograms(userId).filter(
      (p) => p.programId !== program.programId,
    );
    if (program.status === 'active') current.unshift(program);
    this.writeCachedPrograms(userId, current);
  }

  removeCachedProgram(userId: string, programId: string): void {
    this.writeCachedPrograms(
      userId,
      this.readCachedPrograms(userId).filter((p) => p.programId !== programId),
    );
  }

  closeProgramOnce(input: {
    userId: string;
    programId: string;
    endsAt?: string;
  }): Promise<TargetProgramView> {
    return firstValueFrom(
      from(
        this.client.graphql({
          query: /* GraphQL */ `
            mutation CloseTargetProgram($input: CloseTargetProgramInput!) {
              closeTargetProgram(input: $input) { ${PROGRAM_FIELDS} }
            }
          `,
          variables: { input },
        }),
      ).pipe(
        map(
          (resp) =>
            (resp as { data: { closeTargetProgram: TargetProgramView } }).data.closeTargetProgram,
        ),
      ),
    );
  }

  upsertProgramOnce(input: {
    userId: string;
    programId?: string;
    title: string;
    cadence: 'weekly' | 'monthly';
    status?: string;
    platform?: string;
    startsAt: string;
    endsAt?: string;
    targets: Array<{
      metricTypeId: string;
      periodId: string;
      plannedValue: number;
      notes?: string;
    }>;
  }): Promise<TargetProgramView> {
    return firstValueFrom(
      from(
        this.client.graphql({
          query: /* GraphQL */ `
            mutation UpsertTargetProgram($input: UpsertTargetProgramInput!) {
              upsertTargetProgram(input: $input) { ${PROGRAM_FIELDS} }
            }
          `,
          variables: { input },
        }),
      ).pipe(
        map(
          (resp) =>
            (resp as { data: { upsertTargetProgram: TargetProgramView } }).data.upsertTargetProgram,
        ),
      ),
    );
  }

  upsertExecutionOnce(input: {
    userId: string;
    programId: string;
    metricTypeId: string;
    periodId: string;
    actualValue: number;
    notes?: string;
  }): Promise<ActualExecutionView> {
    return firstValueFrom(
      from(
        this.client.graphql({
          query: /* GraphQL */ `
            mutation UpsertActualExecution($input: UpsertActualExecutionInput!) {
              upsertActualExecution(input: $input) {
                programId
                userId
                metricTypeId
                periodId
                actualValue
                recordedAt
                source
                notes
              }
            }
          `,
          variables: { input },
        }),
      ).pipe(
        map(
          (resp) =>
            (resp as { data: { upsertActualExecution: ActualExecutionView } }).data
              .upsertActualExecution,
        ),
      ),
    );
  }

  syncActualsFromMatchesOnce(input: {
    userId: string;
    programId?: string;
    periodId?: string;
    platform?: string;
    matchLimit?: number;
  }): Promise<SyncObjectiveActualsResultView> {
    return firstValueFrom(
      from(
        this.client.graphql({
          query: /* GraphQL */ `
            mutation SyncObjectiveActualsFromMatches(
              $input: SyncObjectiveActualsFromMatchesInput!
            ) {
              syncObjectiveActualsFromMatches(input: $input) {
                programId
                periodId
                matchCount
                synced {
                  metricTypeId
                  periodId
                  actualValue
                  source
                }
                skipped {
                  metricTypeId
                  reason
                }
              }
            }
          `,
          variables: { input },
        }),
      ).pipe(
        map(
          (resp) =>
            (
              resp as {
                data: { syncObjectiveActualsFromMatches: SyncObjectiveActualsResultView };
              }
            ).data.syncObjectiveActualsFromMatches,
        ),
      ),
    );
  }
}

/** Semana ISO actual: 2026-W30 */
export function currentIsoWeekPeriodId(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function currentMonthPeriodId(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function cacheKey(userId: string): string {
  return `sg.objectives.activePrograms.${userId}`;
}
