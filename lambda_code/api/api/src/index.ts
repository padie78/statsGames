import type { AppSyncResolverEvent, AppSyncResolverHandler } from 'aws-lambda';
import type { MatchStatsRollupDto, MatchUpdateDto } from '@stats-games/application';
import {
  getCommunityBenchmarks,
  getMatchAiReport,
  getPlayerProfile,
  getProfileByGamerTag,
  linkPlatformAccount,
  listMatchAiReports,
  listPlayerDailyTrend,
  listPlayerMatches,
  listPlayerStatsRollups,
  listWeeklyLeaderboard,
  searchPlayers,
  upsertPlayerProfile,
} from './composition-root';
import { asPlatform, asStatsGranularity, rethrowAsTyped } from './errors';

type ResolverArgs =
  | { fieldName: 'getPlayerProfile'; args: { userId: string } }
  | { fieldName: 'getProfileByGamerTag'; args: { gamerTag: string } }
  | { fieldName: 'searchPlayers'; args: { query: string; limit?: number | null } }
  | {
      fieldName: 'listPlayerMatches';
      args: { userId: string; platform?: string | null; limit?: number | null };
    }
  | {
      fieldName: 'getMatchAiReport';
      args: { userId: string; matchId: string };
    }
  | {
      fieldName: 'listMatchAiReports';
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
  | {
      fieldName: 'listPlayerDailyTrend';
      args: { userId: string; platform?: string | null; days?: number | null };
    }
  | {
      fieldName: 'getCommunityBenchmarks';
      args: { platform: string; periodId: string };
    }
  | {
      fieldName: 'listWeeklyLeaderboard';
      args: { platform: string; periodId: string; limit?: number | null };
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

function mapMatchUpdate(dto: MatchUpdateDto) {
  return {
    userId: dto.userId,
    matchId: dto.matchId,
    platform: dto.platform,
    summary: dto.summary,
    updatedAt: dto.updatedAt,
    stats: dto.stats ?? null,
  };
}

async function dispatch(op: ResolverArgs): Promise<unknown> {
  switch (op.fieldName) {
    case 'getPlayerProfile':
      return getPlayerProfile.execute({ userId: op.args.userId });

    case 'getProfileByGamerTag':
      return getProfileByGamerTag.execute({ gamerTag: op.args.gamerTag });

    case 'searchPlayers':
      return searchPlayers.execute({
        query: op.args.query,
        limit: op.args.limit ?? undefined,
      });

    case 'listPlayerMatches': {
      const rows = await listPlayerMatches.execute({
        userId: op.args.userId,
        platform: asPlatform(op.args.platform),
        limit: op.args.limit ?? undefined,
      });
      return rows.map(mapMatchUpdate);
    }

    case 'getMatchAiReport':
      return getMatchAiReport.execute({
        userId: op.args.userId,
        matchId: op.args.matchId,
      });

    case 'listMatchAiReports':
      return listMatchAiReports.execute({
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

    case 'listPlayerDailyTrend': {
      const rows = await listPlayerDailyTrend.execute({
        userId: op.args.userId,
        platform: asPlatform(op.args.platform),
        days: op.args.days ?? undefined,
      });
      return rows.map(mapStatsRollup);
    }

    case 'getCommunityBenchmarks': {
      const platform = asPlatform(op.args.platform) ?? 'fortnite';
      const row = await getCommunityBenchmarks.execute({
        platform,
        periodId: op.args.periodId,
      });
      return (
        row ?? {
          platform,
          periodId: op.args.periodId,
          sampleSize: 0,
          avgWinRate: 0,
          avgKd: 0,
          avgKillsPerWeek: 0,
          avgMatchesPerWeek: 0,
          winRateStd: platform === 'roblox' ? 13 : 14,
          kdStd: platform === 'roblox' ? 0.4 : 0.45,
          killsStd: platform === 'roblox' ? 30 : 38,
          lastUpdatedIso: new Date().toISOString(),
        }
      );
    }

    case 'listWeeklyLeaderboard':
      return listWeeklyLeaderboard.execute({
        platform: asPlatform(op.args.platform) ?? 'fortnite',
        periodId: op.args.periodId,
        limit: op.args.limit ?? undefined,
      });

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
