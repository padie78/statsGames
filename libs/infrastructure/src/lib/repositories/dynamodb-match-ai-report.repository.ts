import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type {
  IMatchAiReportRepository,
  MatchAiReportRecord,
} from '@stats-games/application';
import { DynamoKeys, EntityType, type GamePlatform } from '@stats-games/common';
import { getDocumentClient } from '../aws/dynamodb-client.factory';

export class DynamoDbMatchAiReportRepository implements IMatchAiReportRepository {
  private readonly tableName: string;

  constructor(tableName = process.env['TABLE_NAME'] ?? '') {
    if (!tableName) {
      throw new Error('DynamoDbMatchAiReportRepository: TABLE_NAME no configurado.');
    }
    this.tableName = tableName;
  }

  async save(report: MatchAiReportRecord): Promise<void> {
    const client = getDocumentClient();
    await client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: DynamoKeys.userPk(report.userId),
          SK: DynamoKeys.matchAiReportSk(report.matchId),
          entityType: EntityType.MatchAiReport,
          userId: report.userId,
          matchId: report.matchId,
          platform: report.platform,
          headline: report.headline,
          summary: report.summary,
          markdown: report.markdown,
          performanceScore: report.performanceScore,
          gradeLabel: report.gradeLabel,
          verdict: report.verdict,
          pros: report.pros,
          cons: report.cons,
          actionPlan: report.actionPlan,
          status: report.status,
          createdAt: report.createdAt,
        },
      }),
    );
  }

  async getByMatch(userId: string, matchId: string): Promise<MatchAiReportRecord | null> {
    const client = getDocumentClient();
    const result = await client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: DynamoKeys.userPk(userId),
          SK: DynamoKeys.matchAiReportSk(matchId),
        },
      }),
    );
    if (!result.Item) return null;
    return mapItem(result.Item);
  }

  async listByUser(
    userId: string,
    options?: { platform?: GamePlatform; limit?: number },
  ): Promise<MatchAiReportRecord[]> {
    const client = getDocumentClient();
    const limit = options?.limit ?? 20;
    const result = await client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': DynamoKeys.userPk(userId),
          ':skPrefix': DynamoKeys.matchAiReportSkPrefix(),
        },
        Limit: Math.min(100, Math.max(limit * 2, limit)),
        ScanIndexForward: false,
      }),
    );

    let rows = (result.Items ?? []).map(mapItem);
    if (options?.platform) {
      rows = rows.filter((r) => r.platform === options.platform);
    }
    return rows.slice(0, limit);
  }
}

function mapItem(item: Record<string, unknown>): MatchAiReportRecord {
  return {
    userId: String(item['userId']),
    matchId: String(item['matchId']),
    platform: item['platform'] as GamePlatform,
    headline: String(item['headline'] ?? ''),
    summary: String(item['summary'] ?? ''),
    markdown: String(item['markdown'] ?? ''),
    performanceScore: Number(item['performanceScore'] ?? 0),
    gradeLabel: String(item['gradeLabel'] ?? 'C'),
    verdict: String(item['verdict'] ?? 'solid'),
    pros: Array.isArray(item['pros']) ? item['pros'].map(String) : [],
    cons: Array.isArray(item['cons']) ? item['cons'].map(String) : [],
    actionPlan: Array.isArray(item['actionPlan']) ? item['actionPlan'].map(String) : [],
    status: item['status'] === 'failed' ? 'failed' : 'ready',
    createdAt: String(item['createdAt'] ?? new Date().toISOString()),
  };
}
