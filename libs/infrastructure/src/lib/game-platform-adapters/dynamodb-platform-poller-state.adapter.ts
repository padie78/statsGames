import { GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoKeys, type GamePlatform } from '@stats-games/common';
import { getDocumentClient } from '../aws/dynamodb-client.factory';

export interface LinkedPlatformAccount {
  platformUserId: string;
  userId: string;
}

export class DynamoDbPlatformPollerStateAdapter {
  constructor(private readonly tableName = process.env['TABLE_NAME'] ?? '') {
    if (!this.tableName) {
      throw new Error('DynamoDbPlatformPollerStateAdapter: TABLE_NAME no configurado.');
    }
  }

  async listLinkedAccounts(platform: GamePlatform): Promise<LinkedPlatformAccount[]> {
    const client = getDocumentClient();
    const accounts: LinkedPlatformAccount[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;

    do {
      const page = await client.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
          ExpressionAttributeValues: {
            ':pk': `PLATFORM_ACCOUNT#${platform}#`,
            ':sk': DynamoKeys.platformAccountSk(),
          },
          ExclusiveStartKey: exclusiveStartKey,
          ProjectionExpression: 'PK, userId',
        }),
      );

      for (const item of page.Items ?? []) {
        const pk = String(item['PK'] ?? '');
        const userId = item['userId'] ? String(item['userId']) : '';
        const platformUserId = pk.replace(`PLATFORM_ACCOUNT#${platform}#`, '');
        if (platformUserId && userId) accounts.push({ platformUserId, userId });
      }

      exclusiveStartKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (exclusiveStartKey);

    return accounts;
  }

  async loadCursor<TCursor extends Record<string, unknown>>(
    platform: GamePlatform,
    platformUserId: string,
  ): Promise<TCursor | null> {
    const client = getDocumentClient();
    const result = await client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: DynamoKeys.statsSnapshotPk(platform, platformUserId),
          SK: DynamoKeys.statsSnapshotSk(),
        },
      }),
    );
    return result.Item ? (result.Item as TCursor) : null;
  }

  async saveCursor(
    platform: GamePlatform,
    platformUserId: string,
    cursor: Record<string, unknown>,
  ): Promise<void> {
    const client = getDocumentClient();
    await client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: DynamoKeys.statsSnapshotPk(platform, platformUserId),
          SK: DynamoKeys.statsSnapshotSk(),
          entityType: 'STATS_SNAPSHOT',
          platform,
          platformUserId,
          ...cursor,
          updatedAtIso: new Date().toISOString(),
        },
      }),
    );
  }
}
