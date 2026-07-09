import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/api';
import { Observable, from, map } from 'rxjs';
import { authenticatedAppsyncOptions } from '../core/auth/appsync-auth.util';

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

interface ListPlayerStatsRollupsResp {
  listPlayerStatsRollups: PlayerStatsRollupView[];
}

interface ListPlayerDailyTrendResp {
  listPlayerDailyTrend: PlayerStatsRollupView[];
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

@Injectable({ providedIn: 'root' })
export class StatsService {
  private readonly client = generateClient();

  listPlayerStatsRollups(
    userId: string,
    granularity: 'DAILY' | 'WEEKLY' | 'MONTHLY',
    periodId: string,
    platform?: 'fortnite' | 'roblox',
  ): Observable<PlayerStatsRollupView[]> {
    return from(
      this.authenticatedGraphql<{ data: ListPlayerStatsRollupsResp }>({
        query: LIST_PLAYER_STATS_ROLLUPS,
        variables: { userId, granularity, periodId, platform },
      }),
    ).pipe(map((resp) => resp.data.listPlayerStatsRollups));
  }

  listPlayerDailyTrend(
    userId: string,
    platform?: 'fortnite' | 'roblox',
    days = 7,
  ): Observable<PlayerStatsRollupView[]> {
    return from(
      this.authenticatedGraphql<{ data: ListPlayerDailyTrendResp }>({
        query: LIST_PLAYER_DAILY_TREND,
        variables: { userId, platform, days },
      }),
    ).pipe(map((resp) => resp.data.listPlayerDailyTrend));
  }

  private async authenticatedGraphql<T>(params: {
    query: string;
    variables?: Record<string, unknown>;
  }): Promise<T> {
    const authOptions = await authenticatedAppsyncOptions();
    const result = await this.client.graphql({
      query: params.query,
      variables: params.variables,
      ...authOptions,
    });
    return result as T;
  }
}

function currentWeeklyPeriodId(): string {
  const now = new Date();
  const tmp = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function currentWeeklyPeriodIdForStats(): string {
  return currentWeeklyPeriodId();
}
