import type { AppSyncResolverEvent, AppSyncResolverHandler } from 'aws-lambda';
import type { MatchStatsRollupDto } from '@stats-games/application';
import {
  getPlayerProfile,
  linkPlatformAccount,
  listPlayerMatches,
  listPlayerStatsRollups,
  upsertPlayerProfile,
} from './composition-root';
import { asPlatform, asStatsGranularity, rethrowAsTyped } from './errors';

type ResolverArgs =
  | { fieldName: 'getPlayerProfile'; args: { userId: string } }
  | {
      fieldName: 'listPlayerMatches';
      args: { userId: string; platform?: string | null; limit?: number | null };
    }
  | {
      fieldName: 'listPlayerStatsRollups';
      args: {
        userId: string;
        granularity: string;
        periodId: string;
        platform?: string | null;
        limit?: number | null;
      };
    }
  | { fieldName: 'upsertPlayerProfile'; args: { input: Record<string, unknown> } }
  | { fieldName: 'linkPlatformAccount'; args: { input: Record<string, unknown> } }
  | { fieldName: 'ping'; args: { message: string } };

function mapStatsRollup(dto: MatchStatsRollupDto) {
  return {
    userId: dto.userId,
    platform: dto.platform,
    granularity: dto.granularity,
    periodId: dto.periodId,
    matchCount: dto.kpis.match_count,
    totalKills: dto.kpis.total_kills,
    totalDeaths: dto.kpis.total_deaths,
    avgPlacement: dto.kpis.avg_placement,
    versionId: dto.versionId,
    lastUpdatedIso: dto.lastUpdatedIso,
  };
}

async function dispatch(op: ResolverArgs): Promise<unknown> {
  switch (op.fieldName) {
    case 'getPlayerProfile':
      return getPlayerProfile.execute({ userId: op.args.userId });

    case 'listPlayerMatches':
      return listPlayerMatches.execute({
        userId: op.args.userId,
        platform: asPlatform(op.args.platform),
        limit: op.args.limit ?? undefined,
      });

    case 'listPlayerStatsRollups': {
      const rows = await listPlayerStatsRollups.execute({
        userId: op.args.userId,
        granularity: asStatsGranularity(op.args.granularity),
        periodId: op.args.periodId,
        platform: asPlatform(op.args.platform),
        limit: op.args.limit ?? undefined,
      });
      return rows.map(mapStatsRollup);
    }

    case 'upsertPlayerProfile':
      return upsertPlayerProfile.execute(op.args.input);

    case 'linkPlatformAccount':
      return linkPlatformAccount.execute(op.args.input);

    case 'ping':
      return `pong: ${op.args.message}`;

    default:
      throw new Error(`Field no soportado: ${(op as { fieldName: string }).fieldName}`);
  }
}

export const handler: AppSyncResolverHandler<Record<string, unknown>, unknown> = async (
  event: AppSyncResolverEvent<Record<string, unknown>>,
) => {
  const op = {
    fieldName: event.info.fieldName,
    args: event.arguments,
  } as ResolverArgs;

  try {
    return await dispatch(op);
  } catch (err) {
    rethrowAsTyped(err);
  }
};
