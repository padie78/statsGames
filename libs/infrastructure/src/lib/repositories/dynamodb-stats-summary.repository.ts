import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type {
  IStatsRollupReader,
  IStatsSummaryRepository,
} from '@stats-games/application';
import type {
  AggregateMatchStatsResultDto,
  MatchStatsRollupDto,
  ProcessedMatchEventDto,
} from '@stats-games/application';
import { resolveStatsPeriodIds } from '@stats-games/application';
import { EntityType, type StatsGranularity, statsMetricsSk, statsPlayerPk } from '@stats-games/common';
import { getDocumentClient } from '../aws/dynamodb-client.factory';

function extractKpis(stats: Record<string, unknown>) {
  const kills = Number(stats['kills'] ?? stats['eliminations'] ?? 0);
  const deaths = Number(stats['deaths'] ?? 0);
  const placement = Number(stats['placement'] ?? stats['rank'] ?? 0);
  return { kills, deaths, placement };
}

export class DynamoDbStatsSummaryRepository
  implements IStatsSummaryRepository, IStatsRollupReader
{
  private readonly tableName: string;

  constructor(tableName = process.env['TABLE_NAME'] ?? '') {
    if (!tableName) {
      throw new Error('DynamoDbStatsSummaryRepository: TABLE_NAME no configurado.');
    }
    this.tableName = tableName;
  }

  async aggregateMatchEvent(
    event: ProcessedMatchEventDto,
  ): Promise<AggregateMatchStatsResultDto> {
    const periods = resolveStatsPeriodIds(event.occurredAtIso);
    const kpis = extractKpis(event.stats);
    const rollupsUpdated: AggregateMatchStatsResultDto['rollupsUpdated'] = [];
    let skippedDuplicate = false;

    for (const period of periods) {
      const dedupSk = `PROCESSED#MATCH#${event.matchId}#${period.granularity}`;
      const inserted = await this.markProcessed(event.userId, dedupSk, event.matchId);
      if (!inserted) {
        skippedDuplicate = true;
        continue;
      }

      await this.incrementRollup(event, period.granularity, period.periodId, kpis);
      rollupsUpdated.push(period.granularity);
    }

    return {
      matchId: event.matchId,
      rollupsUpdated,
      skippedDuplicate: skippedDuplicate && rollupsUpdated.length === 0,
    };
  }

  async listByPlayerGranularity(
    userId: string,
    granularity: Parameters<IStatsRollupReader['listByPlayerGranularity']>[1],
    periodId: string,
    options?: { platform?: 'fortnite' | 'roblox'; limit?: number },
  ): Promise<MatchStatsRollupDto[]> {
    const client = getDocumentClient();
    const platform = options?.platform ?? 'fortnite';
    const result = await client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: statsPlayerPk(userId),
          SK: `${statsMetricsSk(granularity, periodId)}#${platform}`,
        },
      }),
    );

    if (!result.Item) return [];

    return [this.itemToRollupDto(userId, platform, granularity, periodId, result.Item)];
  }

  async listRecentDailyRollups(
    userId: string,
    options?: { platform?: 'fortnite' | 'roblox'; days?: number },
  ): Promise<MatchStatsRollupDto[]> {
    const client = getDocumentClient();
    const platform = options?.platform ?? 'fortnite';
    const days = Math.min(Math.max(options?.days ?? 7, 1), 30);
    const rollups: MatchStatsRollupDto[] = [];

    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - offset);
      const periodId = formatDailyPeriodId(date);

      const result = await client.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            PK: statsPlayerPk(userId),
            SK: `${statsMetricsSk('DAILY', periodId)}#${platform}`,
          },
        }),
      );

      if (result.Item) {
        rollups.push(this.itemToRollupDto(userId, platform, 'DAILY', periodId, result.Item));
      } else {
        rollups.push({
          userId,
          platform,
          granularity: 'DAILY',
          periodId,
          kpis: {
            match_count: 0,
            total_kills: 0,
            total_deaths: 0,
            avg_placement: 0,
          },
          versionId: 0,
          lastUpdatedIso: date.toISOString(),
        });
      }
    }

    return rollups;
  }

  private itemToRollupDto(
    userId: string,
    platform: 'fortnite' | 'roblox',
    granularity: Parameters<IStatsRollupReader['listByPlayerGranularity']>[1],
    periodId: string,
    item: Record<string, unknown>,
  ): MatchStatsRollupDto {
    const matchCount = Number(item['match_count'] ?? 0);
    const placementSum = Number(item['placement_sum'] ?? 0);

    return {
      userId,
      platform,
      granularity,
      periodId,
      kpis: {
        match_count: matchCount,
        total_kills: Number(item['total_kills'] ?? 0),
        total_deaths: Number(item['total_deaths'] ?? 0),
        avg_placement: matchCount > 0 ? placementSum / matchCount : 0,
      },
      versionId: Number(item['versionId'] ?? 1),
      lastUpdatedIso: String(item['lastUpdatedIso'] ?? new Date().toISOString()),
    };
  }

  private async markProcessed(
    userId: string,
    dedupSk: string,
    matchId: string,
  ): Promise<boolean> {
    const client = getDocumentClient();
    try {
      await client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            PK: statsPlayerPk(userId),
            SK: dedupSk,
            entityType: EntityType.StatsRollup,
            matchId,
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

  private async incrementRollup(
    event: ProcessedMatchEventDto,
    granularity: StatsGranularity,
    periodId: string,
    kpis: { kills: number; deaths: number; placement: number },
  ): Promise<void> {
    const client = getDocumentClient();
    const sk = `${statsMetricsSk(granularity, periodId)}#${event.platform}`;
    const now = new Date().toISOString();

    await client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: statsPlayerPk(event.userId),
          SK: sk,
        },
        UpdateExpression: `
          SET entityType = :entityType,
              userId = :userId,
              platform = :platform,
              granularity = :granularity,
              periodId = :periodId,
              lastUpdatedIso = :now,
              versionId = if_not_exists(versionId, :zero) + :one,
              match_count = if_not_exists(match_count, :zero) + :one,
              total_kills = if_not_exists(total_kills, :zero) + :kills,
              total_deaths = if_not_exists(total_deaths, :zero) + :deaths,
              placement_sum = if_not_exists(placement_sum, :zero) + :placement
        `,
        ExpressionAttributeValues: {
          ':entityType': EntityType.StatsRollup,
          ':userId': event.userId,
          ':platform': event.platform,
          ':granularity': granularity,
          ':periodId': periodId,
          ':now': now,
          ':zero': 0,
          ':one': 1,
          ':kills': kpis.kills,
          ':deaths': kpis.deaths,
          ':placement': kpis.placement,
        },
      }),
    );
  }
}

function formatDailyPeriodId(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
