import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/api';
import { Observable, from, map } from 'rxjs';
import type { BackendPlatform } from '../core/game/selected-game';
import { assertGraphqlData } from '../utils/graphql-error.util';

export interface PlayerStatsRollupView {
  userId: string;
  platform: string;
  granularity: string;
  periodId: string;
  matchCount: number;
  totalKills: number;
  totalDeaths: number;
  avgPlacement: number;
  lastUpdatedIso: string;
}

export interface CommunityBenchmarksView {
  platform: string;
  periodId: string;
  sampleSize: number;
  avgWinRate: number;
  avgKd: number;
  avgKillsPerWeek: number;
  avgMatchesPerWeek: number;
  winRateStd: number;
  kdStd: number;
  killsStd: number;
  lastUpdatedIso: string;
}

export interface LeaderboardEntryView {
  rank: number;
  userId: string;
  gamerTag: string;
  platform: string;
  score: number;
  totalKills: number;
  totalDeaths: number;
  winCount: number;
  winRate: number;
  kd: number;
  matchCount: number;
  delta: string;
  trend: string;
}

interface ListPlayerStatsRollupsResp {
  listPlayerStatsRollups: PlayerStatsRollupView[];
}

interface ListPlayerDailyTrendResp {
  listPlayerDailyTrend: PlayerStatsRollupView[];
}

interface GetCommunityBenchmarksResp {
  getCommunityBenchmarks: CommunityBenchmarksView;
}

interface ListWeeklyLeaderboardResp {
  listWeeklyLeaderboard: LeaderboardEntryView[];
}

const LIST_PLAYER_STATS_ROLLUPS = /* GraphQL */ `
  query ListPlayerStatsRollups(
    $userId: ID!
    $granularity: String!
    $periodId: String!
    $platform: String
  ) {
    listPlayerStatsRollups(
      userId: $userId
      granularity: $granularity
      periodId: $periodId
      platform: $platform
    ) {
      userId
      platform
      granularity
      periodId
      matchCount
      totalKills
      totalDeaths
      avgPlacement
      lastUpdatedIso
    }
  }
`;

const LIST_PLAYER_DAILY_TREND = /* GraphQL */ `
  query ListPlayerDailyTrend($userId: ID!, $platform: String, $days: Int) {
    listPlayerDailyTrend(userId: $userId, platform: $platform, days: $days) {
      userId
      platform
      granularity
      periodId
      matchCount
      totalKills
      totalDeaths
      avgPlacement
      lastUpdatedIso
    }
  }
`;

const GET_COMMUNITY_BENCHMARKS = /* GraphQL */ `
  query GetCommunityBenchmarks($platform: String!, $periodId: String!) {
    getCommunityBenchmarks(platform: $platform, periodId: $periodId) {
      platform
      periodId
      sampleSize
      avgWinRate
      avgKd
      avgKillsPerWeek
      avgMatchesPerWeek
      winRateStd
      kdStd
      killsStd
      lastUpdatedIso
    }
  }
`;

const LIST_WEEKLY_LEADERBOARD = /* GraphQL */ `
  query ListWeeklyLeaderboard($platform: String!, $periodId: String!, $limit: Int) {
    listWeeklyLeaderboard(platform: $platform, periodId: $periodId, limit: $limit) {
      rank
      userId
      gamerTag
      platform
      score
      totalKills
      totalDeaths
      winCount
      winRate
      kd
      matchCount
      delta
      trend
    }
  }
`;

@Injectable({ providedIn: 'root' })
export class StatsService {
  private readonly client = generateClient();

  listPlayerStatsRollups(
    userId: string,
    granularity: 'DAILY' | 'WEEKLY' | 'MONTHLY',
    periodId: string,
    platform?: BackendPlatform,
  ): Observable<PlayerStatsRollupView[]> {
    return from(
      this.client.graphql({
        query: LIST_PLAYER_STATS_ROLLUPS,
        variables: { userId, granularity, periodId, platform },
      }),
    ).pipe(
      map((resp) =>
        assertGraphqlData<ListPlayerStatsRollupsResp>(resp as { data?: ListPlayerStatsRollupsResp })
          .listPlayerStatsRollups,
      ),
    );
  }

  listPlayerDailyTrend(
    userId: string,
    platform?: BackendPlatform,
    days = 7,
  ): Observable<PlayerStatsRollupView[]> {
    return from(
      this.client.graphql({
        query: LIST_PLAYER_DAILY_TREND,
        variables: { userId, platform, days },
      }),
    ).pipe(
      map((resp) =>
        assertGraphqlData<ListPlayerDailyTrendResp>(resp as { data?: ListPlayerDailyTrendResp })
          .listPlayerDailyTrend,
      ),
    );
  }

  getCommunityBenchmarks(
    platform: BackendPlatform,
    periodId: string,
  ): Observable<CommunityBenchmarksView> {
    return from(
      this.client.graphql({
        query: GET_COMMUNITY_BENCHMARKS,
        variables: { platform, periodId },
      }),
    ).pipe(
      map((resp) =>
        assertGraphqlData<GetCommunityBenchmarksResp>(resp as { data?: GetCommunityBenchmarksResp })
          .getCommunityBenchmarks,
      ),
    );
  }

  listWeeklyLeaderboard(
    platform: BackendPlatform,
    periodId: string,
    limit = 5,
  ): Observable<LeaderboardEntryView[]> {
    return from(
      this.client.graphql({
        query: LIST_WEEKLY_LEADERBOARD,
        variables: { platform, periodId, limit },
      }),
    ).pipe(
      map((resp) =>
        assertGraphqlData<ListWeeklyLeaderboardResp>(resp as { data?: ListWeeklyLeaderboardResp })
          .listWeeklyLeaderboard,
      ),
    );
  }
}

function currentWeeklyPeriodId(): string {
  const now = new Date();
  const tmp = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function currentWeeklyPeriodIdForStats(): string {
  return currentWeeklyPeriodId();
}

export function previousWeeklyPeriodIdForStats(): string {
  const current = currentWeeklyPeriodId();
  const match = /^(\d{4})-W(\d{2})$/.exec(current);
  if (!match) return current;

  let year = Number(match[1]);
  let week = Number(match[2]) - 1;

  if (week < 1) {
    year -= 1;
    week = 52;
  }

  return `${year}-W${String(week).padStart(2, '0')}`;
}
