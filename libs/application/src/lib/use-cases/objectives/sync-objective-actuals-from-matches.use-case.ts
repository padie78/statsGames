import {
  deriveObjectiveActualFromMatches,
  getObjectiveMetricType,
  type MatchTelemetrySlice,
} from '@stats-games/common';
import { z } from 'zod';
import type { GamePlatform } from '@stats-games/domain';
import type { ActualExecutionDto } from '../../dto/objectives/objectives.dto';
import type { IMatchReader } from '../../ports/event-network/match.port';
import type { ITargetProgramRepository } from '../../ports/objectives/target-program.repository.port';
import { PeriodIdSchema } from '../../dto/objectives/objectives.dto';

export const SyncObjectiveActualsInputSchema = z.object({
  userId: z.string().min(1),
  programId: z.string().min(1).optional(),
  periodId: PeriodIdSchema.optional(),
  platform: z.string().optional(),
  /** Límite de partidas a leer (default 80). */
  matchLimit: z.number().int().positive().max(200).optional(),
});
export type SyncObjectiveActualsInput = z.infer<typeof SyncObjectiveActualsInputSchema>;

export interface SyncObjectiveActualsResult {
  programId: string;
  periodId: string;
  matchCount: number;
  synced: ActualExecutionDto[];
  skipped: Array<{ metricTypeId: string; reason: string }>;
}

export class SyncObjectiveActualsFromMatchesUseCase {
  constructor(
    private readonly programs: ITargetProgramRepository,
    private readonly matches: IMatchReader,
  ) {}

  async execute(raw: unknown): Promise<SyncObjectiveActualsResult> {
    const input = SyncObjectiveActualsInputSchema.parse(raw);

    const programMeta = input.programId
      ? await this.programs.getProgram(input.userId, input.programId)
      : await (async () => {
          const activeId = await this.programs.getActiveProgramId(input.userId);
          if (!activeId) return null;
          return this.programs.getProgram(input.userId, activeId);
        })();

    if (!programMeta) {
      throw new Error('No hay programa activo para sincronizar.');
    }

    const targets = await this.programs.listTargets(input.userId, programMeta.programId);
    const program = { ...programMeta, targets };

    const periodId =
      input.periodId ??
      (program.cadence === 'monthly'
        ? currentMonthPeriodId()
        : currentIsoWeekPeriodId());

    const platform = (input.platform ?? program.platform) as GamePlatform | undefined;
    const allMatches = await this.matches.listByUser(input.userId, {
      platform: platform || undefined,
      limit: input.matchLimit ?? 80,
    });

    const inPeriod = allMatches.filter((m) =>
      matchBelongsToPeriod(m.occurredAtIso, periodId),
    );

    const slices: MatchTelemetrySlice[] = inPeriod.map((m) => ({
      occurredAtIso: m.occurredAtIso,
      stats: m.stats.toRecord(),
    }));

    const targetMetricIds = [
      ...new Set(
        program.targets
          .filter((t) => t.periodId === periodId)
          .map((t) => t.metricTypeId),
      ),
    ];

    const synced: ActualExecutionDto[] = [];
    const skipped: Array<{ metricTypeId: string; reason: string }> = [];

    for (const metricTypeId of targetMetricIds) {
      const meta = getObjectiveMetricType(metricTypeId);
      if (!meta?.autoSource) {
        skipped.push({ metricTypeId, reason: 'solo_manual' });
        continue;
      }

      const actualValue = deriveObjectiveActualFromMatches(meta.autoSource, slices);
      if (actualValue == null) {
        skipped.push({ metricTypeId, reason: 'sin_datos' });
        continue;
      }

      const execution: ActualExecutionDto = {
        programId: program.programId,
        userId: input.userId,
        metricTypeId,
        periodId,
        actualValue,
        recordedAt: new Date().toISOString(),
        source: 'auto_sync',
        notes: `Sincronizado desde ${slices.length} partidas`,
      };
      await this.programs.upsertExecution(execution);
      synced.push(execution);
    }

    return {
      programId: program.programId,
      periodId,
      matchCount: slices.length,
      synced,
      skipped,
    };
  }
}

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

export function matchBelongsToPeriod(occurredAtIso: string, periodId: string): boolean {
  const d = new Date(occurredAtIso);
  if (Number.isNaN(d.getTime())) return false;
  if (/^\d{4}-W\d{2}$/.test(periodId)) {
    return currentIsoWeekPeriodId(d) === periodId;
  }
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(periodId)) {
    return currentMonthPeriodId(d) === periodId;
  }
  return false;
}
