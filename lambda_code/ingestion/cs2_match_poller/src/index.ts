import type { Handler } from 'aws-lambda';
import { PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoKeys, type GamePlatform } from '@stats-games/common';
import {
  ConsoleLogger,
  getDocumentClient,
} from '@stats-games/infrastructure';

/**
 * Counter-Strike 2 — Steam Web API link validation + cursor.
 *
 * Valve no expone match history pública estable para CS2.
 * Flujo MVP:
 *   1) Vincular SteamID64 en Integraciones
 *   2) Este poller valida el perfil Steam y deja cursor listo
 *   3) Partidas vía webhook / `npm run send:match -- --platform cs2`
 *
 * Env:
 *   STEAM_WEB_API_KEY — si vacío, no-op
 */

interface LinkedAccount {
  platformUserId: string;
  userId: string;
}

interface PollCursor {
  steamId?: string;
  personaName?: string;
  validatedAtIso?: string;
}

const PLATFORM: GamePlatform = 'cs2';
const logger = new ConsoleLogger({ source: 'cs2_match_poller' });

export const handler: Handler = async () => {
  const apiKey = process.env['STEAM_WEB_API_KEY']?.trim();
  if (!apiKey) {
    logger.warn('STEAM_WEB_API_KEY vacío — poller CS2 no-op (webhooks OK)');
    return { ok: false, reason: 'missing_api_key', validated: 0 };
  }

  const accounts = await listLinkedAccounts();
  if (accounts.length === 0) {
    return { ok: true, validated: 0, accounts: 0 };
  }

  let validated = 0;
  for (const account of accounts) {
    try {
      const steamId = account.platformUserId.trim();
      if (!/^7656119\d{10}$/.test(steamId)) {
        logger.warn('SteamID64 inválido', { platformUserId: account.platformUserId });
        continue;
      }

      const summary = await fetchPlayerSummary(steamId, apiKey);
      if (!summary) continue;

      await saveCursor(steamId, {
        steamId,
        personaName: summary.personaname,
        validatedAtIso: new Date().toISOString(),
      });
      validated += 1;
    } catch (error) {
      logger.error('Error validando Steam CS2', {
        platformUserId: account.platformUserId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    ok: true,
    accounts: accounts.length,
    validated,
    note: 'CS2 matches via webhook/send-match; Steam API used for account validation',
  };
};

async function fetchPlayerSummary(
  steamId: string,
  apiKey: string,
): Promise<{ personaname?: string; steamid?: string } | null> {
  const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(apiKey)}&steamids=${encodeURIComponent(steamId)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Steam GetPlayerSummaries ${response.status}: ${await response.text()}`);
  }
  const body = (await response.json()) as {
    response?: { players?: Array<{ steamid?: string; personaname?: string }> };
  };
  const player = body.response?.players?.[0];
  if (!player?.steamid) {
    logger.warn('Steam profile no encontrado', { steamId });
    return null;
  }
  return player;
}

async function listLinkedAccounts(): Promise<LinkedAccount[]> {
  return scanPlatformAccounts(PLATFORM);
}

async function scanPlatformAccounts(platform: GamePlatform): Promise<LinkedAccount[]> {
  const tableName = requireEnv('TABLE_NAME');
  const client = getDocumentClient();
  const accounts: LinkedAccount[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const page = await client.send(
      new ScanCommand({
        TableName: tableName,
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

async function saveCursor(platformUserId: string, cursor: PollCursor): Promise<void> {
  const tableName = requireEnv('TABLE_NAME');
  const client = getDocumentClient();
  await client.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: DynamoKeys.statsSnapshotPk(PLATFORM, platformUserId),
        SK: DynamoKeys.statsSnapshotSk(),
        entityType: 'STATS_SNAPSHOT',
        platform: PLATFORM,
        platformUserId,
        steamId: cursor.steamId ?? null,
        personaName: cursor.personaName ?? null,
        validatedAtIso: cursor.validatedAtIso ?? null,
        updatedAtIso: new Date().toISOString(),
      },
    }),
  );
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} no configurado`);
  return value;
}
