import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { IMatchReader, IMatchWriter } from '@stats-games/application';
import { DynamoKeys, EntityType, KeyPrefix } from '@stats-games/common';
import { Match, MatchStats } from '@stats-games/domain';
import { getDocumentClient } from '../aws/dynamodb-client.factory';

export class DynamoDbMatchRepository implements IMatchWriter, IMatchReader {
  private readonly tableName: string;

  constructor(tableName = process.env['TABLE_NAME'] ?? '') {
    if (!tableName) {
      throw new Error('DynamoDbMatchRepository: TABLE_NAME no configurado.');
    }
    this.tableName = tableName;
  }

  async save(match: Match): Promise<void> {
    const client = getDocumentClient();

    await client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: DynamoKeys.userPk(match.userId),
          SK: DynamoKeys.matchSk(match.platform, match.matchId),
          GSI1PK: DynamoKeys.platformGsi1Pk(match.platform),
          GSI1SK: DynamoKeys.platformGsi1Sk(match.occurredAtIso, match.matchId, match.userId),
          entityType: EntityType.Match,
          userId: match.userId,
          matchId: match.matchId,
          platform: match.platform,
          statsJson: match.stats.toJson(),
          occurredAtIso: match.occurredAtIso,
          correlationId: match.correlationId,
          versionId: match.versionId,
        },
        ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
      }),
    );
  }

  async listByUser(
    userId: string,
    options?: { platform?: 'fortnite' | 'roblox' | 'valorant' | 'rocket_league'; limit?: number },
  ): Promise<Match[]> {
    const client = getDocumentClient();
    const limit = options?.limit ?? 50;
    const prefix = options?.platform
      ? `${KeyPrefix.Match}${options.platform}#`
      : KeyPrefix.Match;

    const result = await client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': DynamoKeys.userPk(userId),
          ':skPrefix': prefix,
        },
        Limit: limit,
        ScanIndexForward: false,
      }),
    );

    return (result.Items ?? []).map((item) =>
      Match.reconstitute({
        userId: String(item['userId']),
        matchId: String(item['matchId']),
        platform: item['platform'] as 'fortnite' | 'roblox' | 'valorant' | 'rocket_league',
        stats: MatchStats.fromRecord(JSON.parse(String(item['statsJson'] ?? '{}'))),
        occurredAtIso: String(item['occurredAtIso']),
        correlationId: String(item['correlationId']),
        versionId: Number(item['versionId'] ?? 1),
      }),
    );
  }
}
