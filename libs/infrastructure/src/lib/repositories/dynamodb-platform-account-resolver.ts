import { GetCommand } from '@aws-sdk/lib-dynamodb';
import type { IPlatformAccountResolver } from '@stats-games/application';
import type { GamePlatform } from '@stats-games/common';
import { DynamoKeys } from '@stats-games/common';
import { getDocumentClient } from '../aws/dynamodb-client.factory';

export class DynamoDbPlatformAccountResolver implements IPlatformAccountResolver {
  private readonly tableName: string;

  constructor(tableName = process.env['TABLE_NAME'] ?? '') {
    if (!tableName) {
      throw new Error('DynamoDbPlatformAccountResolver: TABLE_NAME no configurado.');
    }
    this.tableName = tableName;
  }

  async findUserIdByPlatformAccount(
    platform: GamePlatform,
    externalId: string,
  ): Promise<string | null> {
    const normalizedId = externalId.trim();
    if (!normalizedId) return null;

    const client = getDocumentClient();
    const result = await client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: DynamoKeys.platformAccountPk(platform, normalizedId),
          SK: DynamoKeys.platformAccountSk(),
        },
      }),
    );

    if (!result.Item?.['userId']) return null;
    return String(result.Item['userId']);
  }
}
