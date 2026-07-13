import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { IPlayerProfileRepository } from '@stats-games/application';
import { DynamoKeys, EntityType, normalizeGamerTag } from '@stats-games/common';
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
    return this.itemToProfile(result.Item);
  }

  async findByGamerTag(gamerTag: string): Promise<PlayerProfile | null> {
    const normalized = normalizeGamerTag(gamerTag);
    if (!normalized) return null;

    const client = getDocumentClient();
    const lookup = await client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: DynamoKeys.gamerTagPk(normalized),
          SK: DynamoKeys.profileSk(),
        },
      }),
    );

    const userId = lookup.Item?.['userId'];
    if (!userId) return null;

    return this.findByUserId(String(userId));
  }

  async searchByGamerTagPrefix(query: string, limit = 10): Promise<PlayerProfile[]> {
    const normalized = normalizeGamerTag(query);
    if (!normalized || normalized.length < 2) return [];

    const client = getDocumentClient();
    const result = await client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk AND begins_with(GSI2SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': DynamoKeys.gamerTagGsi2Pk(),
          ':prefix': normalized,
        },
        Limit: Math.min(limit, 25),
      }),
    );

    const profiles: PlayerProfile[] = [];
    for (const item of result.Items ?? []) {
      const userId = item['userId'];
      if (!userId) continue;
      const profile = await this.findByUserId(String(userId));
      if (profile) profiles.push(profile);
    }

    return profiles;
  }

  async save(profile: PlayerProfile): Promise<void> {
    const client = getDocumentClient();
    const existing = await this.findByUserId(profile.userId);
    const normalizedTag = normalizeGamerTag(profile.gamerTag);

    if (existing && normalizeGamerTag(existing.gamerTag) !== normalizedTag) {
      await this.removeGamerTagLookup(normalizeGamerTag(existing.gamerTag));
    }

    await this.assertGamerTagAvailable(normalizedTag, profile.userId);

    await client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: DynamoKeys.userPk(profile.userId),
          SK: DynamoKeys.profileSk(),
          GSI2PK: DynamoKeys.gamerTagGsi2Pk(),
          GSI2SK: DynamoKeys.gamerTagGsi2Sk(normalizedTag, profile.userId),
          entityType: EntityType.Player,
          userId: profile.userId,
          gamerTag: profile.gamerTag,
          gamerTagNormalized: normalizedTag,
          primaryPlatform: profile.primaryPlatform,
          fortniteId: profile.fortniteId,
          robloxId: profile.robloxId,
          valorantId: profile.valorantId,
          leagueOfLegendsId: profile.leagueOfLegendsId,
          cs2Id: profile.cs2Id,
          rocketLeagueId: profile.rocketLeagueId,
          avatarUrl: profile.avatarUrl,
          createdAtIso: profile.createdAtIso,
          updatedAtIso: profile.updatedAtIso,
          versionId: profile.versionId,
        },
      }),
    );

    await client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: DynamoKeys.gamerTagPk(normalizedTag),
          SK: DynamoKeys.profileSk(),
          entityType: EntityType.GamerTagLookup,
          userId: profile.userId,
          gamerTag: profile.gamerTag,
          updatedAtIso: profile.updatedAtIso,
        },
      }),
    );

    await this.syncPlatformAccountLinks(profile);
  }

  private async assertGamerTagAvailable(normalizedTag: string, userId: string): Promise<void> {
    const client = getDocumentClient();
    const lookup = await client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: DynamoKeys.gamerTagPk(normalizedTag),
          SK: DynamoKeys.profileSk(),
        },
      }),
    );

    const owner = lookup.Item?.['userId'];
    if (owner && String(owner) !== userId) {
      throw new Error(`El gamerTag "${normalizedTag}" ya está en uso.`);
    }
  }

  private async removeGamerTagLookup(normalizedTag: string): Promise<void> {
    const client = getDocumentClient();
    await client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: DynamoKeys.gamerTagPk(normalizedTag),
          SK: DynamoKeys.profileSk(),
        },
      }),
    );
  }

  private itemToProfile(item: Record<string, unknown>): PlayerProfile {
    return PlayerProfile.reconstitute({
      userId: String(item['userId']),
      gamerTag: String(item['gamerTag']),
      primaryPlatform: item['primaryPlatform'] as PlayerProfile['primaryPlatform'],
      fortniteId: item['fortniteId'] ? String(item['fortniteId']) : undefined,
      robloxId: item['robloxId'] ? String(item['robloxId']) : undefined,
      valorantId: item['valorantId'] ? String(item['valorantId']) : undefined,
      leagueOfLegendsId: item['leagueOfLegendsId']
        ? String(item['leagueOfLegendsId'])
        : undefined,
      cs2Id: item['cs2Id'] ? String(item['cs2Id']) : undefined,
      rocketLeagueId: item['rocketLeagueId'] ? String(item['rocketLeagueId']) : undefined,
      avatarUrl: item['avatarUrl'] ? String(item['avatarUrl']) : undefined,
      createdAtIso: String(item['createdAtIso']),
      updatedAtIso: String(item['updatedAtIso']),
      versionId: Number(item['versionId'] ?? 1),
    });
  }

  private async syncPlatformAccountLinks(profile: PlayerProfile): Promise<void> {
    const client = getDocumentClient();
    const links: Array<{ platform: PlayerProfile['primaryPlatform']; externalId: string }> = [];

    if (profile.fortniteId) {
      links.push({ platform: 'fortnite', externalId: profile.fortniteId });
    }
    if (profile.robloxId) {
      links.push({ platform: 'roblox', externalId: profile.robloxId });
    }
    if (profile.valorantId) {
      links.push({ platform: 'valorant', externalId: profile.valorantId });
    }
    if (profile.leagueOfLegendsId) {
      links.push({ platform: 'league_of_legends', externalId: profile.leagueOfLegendsId });
    }
    if (profile.cs2Id) {
      links.push({ platform: 'cs2', externalId: profile.cs2Id });
    }
    if (profile.rocketLeagueId) {
      links.push({ platform: 'rocket_league', externalId: profile.rocketLeagueId });
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
