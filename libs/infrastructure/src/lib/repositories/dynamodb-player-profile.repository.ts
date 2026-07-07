import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { IPlayerProfileRepository } from '@stats-games/application';
import { DynamoKeys, EntityType, type GamePlatform } from '@stats-games/common';
import { PlayerProfile } from '@stats-games/domain';
import { getDocumentClient } from '../aws/dynamodb-client.factory';

export class DynamoDbPlayerProfileRepository implements IPlayerProfileRepository {
  private readonly tableName: string;

  constructor(tableName = process.env['TABLE_NAME'] ?? '') {
    if (!tableName) {
      throw new Error('DynamoDbPlayerProfileRepository: TABLE_NAME no configurado.');
    }
    this.tableName = tableName;
  }

  async findByUserId(userId: string): Promise<PlayerProfile | null> {
    const client = getDocumentClient();
    const result = await client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: DynamoKeys.userPk(userId),
          SK: DynamoKeys.profileSk(),
        },
      }),
    );

    if (!result.Item) return null;

    return PlayerProfile.reconstitute({
      userId: String(result.Item['userId']),
      gamerTag: String(result.Item['gamerTag']),
      primaryPlatform: result.Item['primaryPlatform'] as 'fortnite' | 'roblox',
      fortniteId: result.Item['fortniteId'] ? String(result.Item['fortniteId']) : undefined,
      robloxId: result.Item['robloxId'] ? String(result.Item['robloxId']) : undefined,
      avatarUrl: result.Item['avatarUrl'] ? String(result.Item['avatarUrl']) : undefined,
      createdAtIso: String(result.Item['createdAtIso']),
      updatedAtIso: String(result.Item['updatedAtIso']),
      versionId: Number(result.Item['versionId'] ?? 1),
    });
  }

  async save(profile: PlayerProfile): Promise<void> {
    const client = getDocumentClient();

    await client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: DynamoKeys.userPk(profile.userId),
          SK: DynamoKeys.profileSk(),
          entityType: EntityType.Player,
          userId: profile.userId,
          gamerTag: profile.gamerTag,
          primaryPlatform: profile.primaryPlatform,
          fortniteId: profile.fortniteId,
          robloxId: profile.robloxId,
          avatarUrl: profile.avatarUrl,
          createdAtIso: profile.createdAtIso,
          updatedAtIso: profile.updatedAtIso,
          versionId: profile.versionId,
        },
      }),
    );

    await this.syncPlatformAccountLinks(profile);
  }

  private async syncPlatformAccountLinks(profile: PlayerProfile): Promise<void> {
    const client = getDocumentClient();
    const links: Array<{ platform: GamePlatform; externalId: string }> = [];

    if (profile.fortniteId) {
      links.push({ platform: 'fortnite', externalId: profile.fortniteId });
    }
    if (profile.robloxId) {
      links.push({ platform: 'roblox', externalId: profile.robloxId });
    }

    for (const link of links) {
      await client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            PK: DynamoKeys.platformAccountPk(link.platform, link.externalId),
            SK: DynamoKeys.platformAccountSk(),
            entityType: EntityType.PlatformAccountLink,
            platform: link.platform,
            externalId: link.externalId,
            userId: profile.userId,
            updatedAtIso: profile.updatedAtIso,
          },
        }),
      );
    }
  }
}
