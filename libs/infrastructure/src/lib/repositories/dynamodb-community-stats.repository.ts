import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { ICommunityStatsRepository } from '@stats-games/application';
import type {
  CommunityBenchmarksDto,
  LeaderboardEntryDto,
  SyncWeeklyCommunityInput,
} from '@stats-games/application';
import {
  EntityType,
  communityBenchmarkPk,
  communityBenchmarkSk,
  communityPlayerSeenSk,
  leaderboardPk,
  leaderboardUserSk,
  statsPlayerPk,
} from '@stats-games/common';
import { getDocumentClient } from '../aws/dynamodb-client.factory';

const DEFAULT_STD = {
  fortnite: { winRateStd: 14, kdStd: 0.45, killsStd: 38 },
  roblox: { winRateStd: 13, kdStd: 0.4, killsStd: 30 },
  valorant: { winRateStd: 12, kdStd: 0.35, killsStd: 18 },
  league_of_legends: { winRateStd: 12, kdStd: 0.4, killsStd: 10 },
  cs2: { winRateStd: 12, kdStd: 0.35, killsStd: 20 },
  rocket_league: { winRateStd: 15, kdStd: 0.5, killsStd: 12 },
} as const;

function computeLeaderboardScore(input: SyncWeeklyCommunityInput): number {
  return input.totalKills * 10 + input.winCount * 100 + input.matchCount * 5;
}

export class DynamoDbCommunityStatsRepository implements ICommunityStatsRepository {
  private readonly tableName: string;

  constructor(tableName = process.env['TABLE_NAME'] ?? '') {
    if (!tableName) {
      throw new Error('DynamoDbCommunityStatsRepository: TABLE_NAME no configurado.');
    }
    this.tableName = tableName;
  }

  async syncWeeklyPlayerStats(input: SyncWeeklyCommunityInput): Promise<void> {
    const client = getDocumentClient();
    const now = new Date().toISOString();
    const isNewPlayer = await this.markPlayerSeen(input.userId, input.periodId, input.platform);

    await client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: communityBenchmarkPk(input.platform),
          SK: communityBenchmarkSk(input.periodId),
        },
        UpdateExpression: `
          SET entityType = :entityType,
              platform = :platform,
              periodId = :periodId,
              lastUpdatedIso = :now,
              player_count = if_not_exists(player_count, :zero) + :playerDelta
        `,
        ExpressionAttributeValues: {
          ':entityType': EntityType.CommunityBenchmark,
          ':platform': input.platform,
          ':periodId': input.periodId,
          ':now': now,
          ':zero': 0,
          ':playerDelta': isNewPlayer ? 1 : 0,
        },
      }),
    );

    await this.recomputeCommunityBenchmarkTotals(input.platform, input.periodId);

    const score = computeLeaderboardScore(input);
    await client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: leaderboardPk(input.platform, input.periodId),
          SK: leaderboardUserSk(input.userId),
          entityType: EntityType.LeaderboardEntry,
          userId: input.userId,
          platform: input.platform,
          periodId: input.periodId,
          score,
          totalKills: input.totalKills,
          matchCount: input.matchCount,
          winCount: input.winCount,
          totalDeaths: input.totalDeaths,
          lastUpdatedIso: now,
        },
      }),
    );
  }

  async getCommunityBenchmarks(
    platform: 'fortnite' | 'roblox' | 'valorant' | 'league_of_legends' | 'cs2' | 'rocket_league',
    periodId: string,
  ): Promise<CommunityBenchmarksDto | null> {
    const client = getDocumentClient();
    const result = await client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: communityBenchmarkPk(platform),
          SK: communityBenchmarkSk(periodId),
        },
      }),
    );

    if (!result.Item) return null;

    const matchCount = Number(result.Item['match_count'] ?? 0);
    const playerCount = Number(result.Item['player_count'] ?? 0);
    const totalKills = Number(result.Item['total_kills'] ?? 0);
    const totalDeaths = Number(result.Item['total_deaths'] ?? 0);
    const winCount = Number(result.Item['win_count'] ?? 0);
    const sampleSize = Math.max(playerCount, 0);

    if (sampleSize === 0 && matchCount === 0) return null;

    const avgWinRate = matchCount > 0 ? (winCount / matchCount) * 100 : 0;
    const avgKd = totalDeaths > 0 ? totalKills / totalDeaths : totalKills;
    const divisor = Math.max(sampleSize, 1);

    return {
      platform,
      periodId,
      sampleSize,
      avgWinRate: round1(avgWinRate),
      avgKd: round2(avgKd),
      avgKillsPerWeek: round1(totalKills / divisor),
      avgMatchesPerWeek: round1(matchCount / divisor),
      ...DEFAULT_STD[platform],
      lastUpdatedIso: String(result.Item['lastUpdatedIso'] ?? new Date().toISOString()),
    };
  }

  async listWeeklyLeaderboard(
    platform: 'fortnite' | 'roblox' | 'valorant' | 'league_of_legends' | 'cs2' | 'rocket_league',
    periodId: string,
    limit: number,
  ): Promise<LeaderboardEntryDto[]> {
    const client = getDocumentClient();
    const result = await client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': leaderboardPk(platform, periodId),
          ':skPrefix': 'USER#',
        },
      }),
    );

    const rows = (result.Items ?? [])
      .map((item) => ({
        userId: String(item['userId'] ?? ''),
        platform,
        score: Number(item['score'] ?? 0),
        totalKills: Number(item['totalKills'] ?? 0),
        matchCount: Number(item['matchCount'] ?? 0),
      }))
      .filter((row) => row.userId)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(Math.max(limit, 1), 50));

    return rows.map((row, index) => ({
      rank: index + 1,
      userId: row.userId,
      gamerTag: row.userId,
      platform: row.platform,
      score: row.score,
      totalKills: row.totalKills,
      matchCount: row.matchCount,
      delta: '—',
      trend: 'flat' as const,
    }));
  }

  private async recomputeCommunityBenchmarkTotals(
    platform: 'fortnite' | 'roblox' | 'valorant' | 'league_of_legends' | 'cs2' | 'rocket_league',
    periodId: string,
  ): Promise<void> {
    const client = getDocumentClient();
    const leaderboard = await client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': leaderboardPk(platform, periodId),
          ':skPrefix': 'USER#',
        },
      }),
    );

    let matchCount = 0;
    let totalKills = 0;
    let totalDeaths = 0;
    let winCount = 0;

    for (const item of leaderboard.Items ?? []) {
      matchCount += Number(item['matchCount'] ?? 0);
      totalKills += Number(item['totalKills'] ?? 0);
      totalDeaths += Number(item['totalDeaths'] ?? 0);
      winCount += Number(item['winCount'] ?? 0);
    }

    await client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: communityBenchmarkPk(platform),
          SK: communityBenchmarkSk(periodId),
        },
        UpdateExpression: `
          SET match_count = :matchCount,
              total_kills = :totalKills,
              total_deaths = :totalDeaths,
              win_count = :winCount,
              lastUpdatedIso = :now
        `,
        ExpressionAttributeValues: {
          ':matchCount': matchCount,
          ':totalKills': totalKills,
          ':totalDeaths': totalDeaths,
          ':winCount': winCount,
          ':now': new Date().toISOString(),
        },
      }),
    );
  }

  private async markPlayerSeen(
    userId: string,
    periodId: string,
    platform: 'fortnite' | 'roblox' | 'valorant' | 'league_of_legends' | 'cs2' | 'rocket_league',
  ): Promise<boolean> {
    const client = getDocumentClient();
    try {
      await client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            PK: statsPlayerPk(userId),
            SK: communityPlayerSeenSk(periodId, platform),
            entityType: EntityType.CommunityPlayerSeen,
            userId,
            platform,
            periodId,
          },
          ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
        }),
      );
      return true;
    } catch (error) {
      if ((error as { name?: string }).name === 'ConditionalCheckFailedException') {
        return false;
      }
      throw error;
    }
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
