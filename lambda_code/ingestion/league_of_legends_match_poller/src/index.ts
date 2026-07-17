import type { Handler } from 'aws-lambda';
import { GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoKeys, type GamePlatform } from '@stats-games/common';
import {
  ConsoleLogger,
  SqsGameIngestionQueuePublisherAdapter,
  getDocumentClient,
} from '@stats-games/infrastructure';

/**
 * League of Legends — Riot match-v5 + match-timeline-v5.
 *
 * Vinculá Riot ID `Nombre#TAG` en Integraciones.
 * Poller: account-v1 → matchlist-v5 → match-v5 → timeline-v5 → SQS.
 *
 * Timeline aporta path (x,y) por frame (~1 min) y hitos (kills/deaths/objetivos).
 * Live Client Data (127.0.0.1:2999) queda para companion Electron/Overwolf (in-match).
 *
 * Env:
 *   RIOT_API_KEY
 *   LOL_REGION   (routing: americas|europe|asia|sea) default europe
 */

interface LinkedAccount {
  platformUserId: string;
  userId: string;
}

interface PollCursor {
  puuid?: string;
  seenMatchIds: string[];
}

interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}

interface LolMatchSummary {
  matchId: string;
  champion?: string;
  role?: string;
  kills: number;
  deaths: number;
  assists: number;
  cs?: number;
  visionScore?: number;
  won?: boolean;
  queueId?: number;
  gameStartMillis?: number;
  durationSec?: number;
  goldEarned?: number;
  champLevel?: number;
  items?: number[];
  teamObjectives?: {
    barons: number;
    dragons: number;
    towers: number;
  };
  mode?: string;
  participantId?: number;
  mapTelemetry?: LolMapTelemetry;
}

interface LolMapPoint {
  t: number;
  x: number;
  y: number;
}

interface LolMapEvent {
  t: number;
  type: string;
  x: number;
  y: number;
  poi?: string;
  label?: string;
  detail?: string;
  impact?: string;
}

interface LolMapTelemetry {
  source: 'riot_timeline_v5';
  durationSec: number;
  path: LolMapPoint[];
  events: LolMapEvent[];
  participantId?: number;
  coordinateSpace: { maxX: number; maxY: number };
}

const RIFT_MAX = 15_000;

const RIFT_POIS: Array<{ name: string; x: number; y: number }> = [
  { name: 'Blue Base', x: 0.12, y: 0.88 },
  { name: 'Red Base', x: 0.88, y: 0.12 },
  { name: 'Top Lane', x: 0.18, y: 0.35 },
  { name: 'Mid Lane', x: 0.5, y: 0.5 },
  { name: 'Bot Lane', x: 0.72, y: 0.82 },
  { name: 'Dragon Pit', x: 0.62, y: 0.62 },
  { name: 'Baron Pit', x: 0.38, y: 0.38 },
  { name: 'Blue Jungle', x: 0.28, y: 0.55 },
  { name: 'Red Jungle', x: 0.72, y: 0.45 },
  { name: 'River', x: 0.5, y: 0.48 },
];


const PLATFORM: GamePlatform = 'league_of_legends';
const logger = new ConsoleLogger({ source: 'league_of_legends_match_poller' });
const MAX_SEEN = 40;

const QUEUE_MODE: Record<number, string> = {
  420: 'Ranked Solo',
  440: 'Ranked Flex',
  450: 'ARAM',
  400: 'Normal Draft',
  430: 'Normal Blind',
  700: 'Clash',
  1700: 'Arena',
};

export const handler: Handler = async () => {
  const apiKey = process.env['RIOT_API_KEY']?.trim();
  if (!apiKey) {
    logger.warn('RIOT_API_KEY vacío — poller LoL no-op');
    return { ok: false, reason: 'missing_api_key', enqueued: 0 };
  }

  const region = (process.env['LOL_REGION'] ?? 'europe').trim();
  const accounts = await listLinkedAccounts();
  if (accounts.length === 0) {
    return { ok: true, enqueued: 0, accounts: 0 };
  }

  const publisher = new SqsGameIngestionQueuePublisherAdapter();
  let enqueued = 0;

  for (const account of accounts) {
    try {
      const riotId = parseRiotId(account.platformUserId);
      if (!riotId) {
        logger.warn('Riot ID inválido (esperado Nombre#TAG)', {
          platformUserId: account.platformUserId,
        });
        continue;
      }

      const cursor = (await loadCursor(account.platformUserId)) ?? { seenMatchIds: [] };
      let puuid = cursor.puuid;
      if (!puuid) {
        const resolved = await fetchRiotAccount(riotId.gameName, riotId.tagLine, region, apiKey);
        if (!resolved) continue;
        puuid = resolved.puuid;
      }

      const matchIds = await fetchRecentMatchIds(puuid, region, apiKey);
      const newIds = matchIds.filter((id) => !cursor.seenMatchIds.includes(id));

      for (const matchId of newIds.slice(0, 5)) {
        const detail = await fetchMatchForPlayer(matchId, puuid, region, apiKey);
        if (!detail) continue;

        const timeline = await fetchMatchTimelineForPlayer(
          matchId,
          puuid,
          detail.participantId,
          detail.durationSec,
          region,
          apiKey,
        );
        if (timeline) detail.mapTelemetry = timeline;

        const summary = buildSummary(detail);
        await publisher.enqueue({
          userId: account.userId,
          matchId: `lol-${detail.matchId}`,
          platform: PLATFORM,
          stats: {
            kills: detail.kills,
            deaths: detail.deaths,
            assists: detail.assists,
            cs: detail.cs ?? null,
            visionScore: detail.visionScore ?? null,
            champion: detail.champion ?? null,
            role: detail.role ?? null,
            mode: detail.mode ?? null,
            queueId: detail.queueId ?? null,
            durationSec: detail.durationSec ?? null,
            goldEarned: detail.goldEarned ?? null,
            champLevel: detail.champLevel ?? null,
            items: detail.items ?? [],
            teamObjectives: detail.teamObjectives ?? null,
            teamBarons: detail.teamObjectives?.barons ?? null,
            teamDragons: detail.teamObjectives?.dragons ?? null,
            teamTowers: detail.teamObjectives?.towers ?? null,
            mapTelemetry: detail.mapTelemetry ?? null,
            won: detail.won ?? null,
            summary,
            source: 'league_of_legends_match_poller',
            ...(detail.won ? { placement: 1 } : { placement: 2 }),
          },
          occurredAtIso: detail.gameStartMillis
            ? new Date(detail.gameStartMillis).toISOString()
            : new Date().toISOString(),
          correlationId: `lol-poll-${detail.matchId}`,
        });
        enqueued += 1;
      }

      const seenMatchIds = [...newIds, ...cursor.seenMatchIds].slice(0, MAX_SEEN);
      await saveCursor(account.platformUserId, { puuid, seenMatchIds });
    } catch (error) {
      logger.error('Error polleando LoL', {
        platformUserId: account.platformUserId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { ok: true, accounts: accounts.length, enqueued };
};

function parseRiotId(raw: string): { gameName: string; tagLine: string } | null {
  const trimmed = raw.trim();
  const hash = trimmed.lastIndexOf('#');
  if (hash <= 0 || hash === trimmed.length - 1) return null;
  return {
    gameName: trimmed.slice(0, hash).trim(),
    tagLine: trimmed.slice(hash + 1).trim(),
  };
}

function buildSummary(detail: LolMatchSummary): string {
  const bits = ['LoL'];
  if (detail.mode) bits.push(detail.mode);
  if (detail.champion) bits.push(detail.champion);
  if (detail.role) bits.push(detail.role);
  if (detail.won === true) bits.push('Victoria');
  else if (detail.won === false) bits.push('Derrota');
  bits.push(`${detail.kills}/${detail.deaths}/${detail.assists}`);
  if (detail.cs != null) bits.push(`${detail.cs} CS`);
  return bits.join(' · ').slice(0, 200);
}

async function fetchRiotAccount(
  gameName: string,
  tagLine: string,
  region: string,
  apiKey: string,
): Promise<RiotAccount | null> {
  const url = `https://${region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  const response = await fetch(url, { headers: { 'X-Riot-Token': apiKey } });
  if (response.status === 404) {
    logger.warn('Riot account no encontrada', { gameName, tagLine });
    return null;
  }
  if (!response.ok) {
    throw new Error(`Riot account ${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as RiotAccount;
}

async function fetchRecentMatchIds(puuid: string, region: string, apiKey: string): Promise<string[]> {
  const url = `https://${region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=0&count=10`;
  const response = await fetch(url, { headers: { 'X-Riot-Token': apiKey } });
  if (!response.ok) {
    throw new Error(`LoL matchlist ${response.status}: ${await response.text()}`);
  }
  const body = (await response.json()) as string[];
  return Array.isArray(body) ? body.filter(Boolean) : [];
}

async function fetchMatchForPlayer(
  matchId: string,
  puuid: string,
  region: string,
  apiKey: string,
): Promise<LolMatchSummary | null> {
  const url = `https://${region}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`;
  const response = await fetch(url, { headers: { 'X-Riot-Token': apiKey } });
  if (!response.ok) {
    logger.warn('No se pudo leer match LoL', { matchId, status: response.status });
    return null;
  }

  const body = (await response.json()) as {
    info?: {
      queueId?: number;
      gameStartTimestamp?: number;
      gameDuration?: number;
      participants?: Array<{
        puuid?: string;
        participantId?: number;
        teamId?: number;
        championName?: string;
        teamPosition?: string;
        individualPosition?: string;
        kills?: number;
        deaths?: number;
        assists?: number;
        totalMinionsKilled?: number;
        neutralMinionsKilled?: number;
        visionScore?: number;
        win?: boolean;
        goldEarned?: number;
        champLevel?: number;
        item0?: number;
        item1?: number;
        item2?: number;
        item3?: number;
        item4?: number;
        item5?: number;
        item6?: number;
      }>;
      teams?: Array<{
        teamId?: number;
        objectives?: {
          baron?: { kills?: number };
          dragon?: { kills?: number };
          tower?: { kills?: number };
        };
      }>;
    };
    metadata?: { matchId?: string };
  };

  const player = body.info?.participants?.find((p) => p.puuid === puuid);
  if (!player) return null;

  const queueId = body.info?.queueId;
  const cs =
    Number(player.totalMinionsKilled ?? 0) + Number(player.neutralMinionsKilled ?? 0);
  const team = body.info?.teams?.find((t) => t.teamId === player.teamId);
  const items = [
    player.item0,
    player.item1,
    player.item2,
    player.item3,
    player.item4,
    player.item5,
    player.item6,
  ]
    .map((item) => Number(item ?? 0))
    .filter((item) => item > 0);

  return {
    matchId: body.metadata?.matchId ?? matchId,
    champion: player.championName,
    role: player.teamPosition || player.individualPosition,
    kills: Number(player.kills ?? 0),
    deaths: Number(player.deaths ?? 0),
    assists: Number(player.assists ?? 0),
    cs,
    visionScore: player.visionScore != null ? Number(player.visionScore) : undefined,
    won: player.win,
    queueId,
    mode: queueId != null ? QUEUE_MODE[queueId] ?? `Queue ${queueId}` : undefined,
    gameStartMillis: body.info?.gameStartTimestamp,
    durationSec: body.info?.gameDuration != null ? Number(body.info.gameDuration) : undefined,
    goldEarned: player.goldEarned != null ? Number(player.goldEarned) : undefined,
    champLevel: player.champLevel != null ? Number(player.champLevel) : undefined,
    items,
    participantId: player.participantId != null ? Number(player.participantId) : undefined,
    teamObjectives: team
      ? {
          barons: Number(team.objectives?.baron?.kills ?? 0),
          dragons: Number(team.objectives?.dragon?.kills ?? 0),
          towers: Number(team.objectives?.tower?.kills ?? 0),
        }
      : undefined,
  };
}

/**
 * Match-Timeline-V5: frames ~1 min con position (x,y) 0–15000 + eventos de kill/objetivos.
 */
async function fetchMatchTimelineForPlayer(
  matchId: string,
  puuid: string,
  participantIdHint: number | undefined,
  durationSecHint: number | undefined,
  region: string,
  apiKey: string,
): Promise<LolMapTelemetry | null> {
  const url = `https://${region}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}/timeline`;
  const response = await fetch(url, { headers: { 'X-Riot-Token': apiKey } });
  if (!response.ok) {
    logger.warn('No se pudo leer timeline LoL', { matchId, status: response.status });
    return null;
  }

  const body = (await response.json()) as {
    metadata?: { participants?: string[] };
    info?: {
      frameInterval?: number;
      frames?: Array<{
        timestamp?: number;
        participantFrames?: Record<
          string,
          {
            position?: { x?: number; y?: number };
          }
        >;
        events?: Array<{
          type?: string;
          timestamp?: number;
          killerId?: number;
          victimId?: number;
          assistingParticipantIds?: number[];
          monsterType?: string;
          buildingType?: string;
          towerType?: string;
          position?: { x?: number; y?: number };
        }>;
      }>;
    };
  };

  const participants = body.metadata?.participants ?? [];
  let participantId = participantIdHint;
  if (participantId == null) {
    const idx = participants.findIndex((id) => id === puuid);
    participantId = idx >= 0 ? idx + 1 : undefined;
  }
  if (participantId == null) return null;

  const frames = body.info?.frames ?? [];
  const path: LolMapPoint[] = [];
  const events: LolMapEvent[] = [];
  let killCount = 0;
  let deathCount = 0;
  let assistCount = 0;

  for (const frame of frames) {
    const tSec = Math.max(0, Math.round(Number(frame.timestamp ?? 0) / 1000));
    const pf = frame.participantFrames?.[String(participantId)];
    if (pf?.position && Number.isFinite(pf.position.x) && Number.isFinite(pf.position.y)) {
      const norm = riotToNorm(Number(pf.position.x), Number(pf.position.y));
      path.push({ t: tSec, ...norm });
    }

    for (const event of frame.events ?? []) {
      const et = Math.max(0, Math.round(Number(event.timestamp ?? 0) / 1000));
      const pos = event.position
        ? riotToNorm(Number(event.position.x ?? 0), Number(event.position.y ?? 0))
        : path.length
          ? { x: path[path.length - 1].x, y: path[path.length - 1].y }
          : { x: 0.5, y: 0.5 };
      const poi = nearestRiftPoi(pos.x, pos.y);

      if (event.type === 'CHAMPION_KILL') {
        if (event.killerId === participantId) {
          killCount += 1;
          events.push({
            t: et,
            type: 'kill',
            x: pos.x,
            y: pos.y,
            poi,
            label: `Kill #${killCount}`,
            detail: `Eliminación en ${poi} (coordenada Riot Timeline-V5).`,
            impact: '+1 kill',
          });
        } else if (event.victimId === participantId) {
          deathCount += 1;
          events.push({
            t: et,
            type: 'death',
            x: pos.x,
            y: pos.y,
            poi,
            label: `Death #${deathCount}`,
            detail: `Caída en ${poi}. Revisá visión y spacing en esta zona.`,
            impact: '−1',
          });
        } else if (event.assistingParticipantIds?.includes(participantId)) {
          assistCount += 1;
          events.push({
            t: et,
            type: 'assist',
            x: pos.x,
            y: pos.y,
            poi,
            label: `Assist #${assistCount}`,
            detail: `Asistencia cerca de ${poi}.`,
            impact: '+1 assist',
          });
        }
      } else if (event.type === 'ELITE_MONSTER_KILL') {
        const monster = String(event.monsterType ?? 'OBJECTIVE').toUpperCase();
        const isTeamRelevant =
          event.killerId === participantId ||
          event.assistingParticipantIds?.includes(participantId);
        if (!isTeamRelevant && event.killerId !== participantId) {
          // Igual marcamos objetivos del mapa si el evento tiene posición (contexto).
        }
        if (monster.includes('DRAGON')) {
          events.push({
            t: et,
            type: 'dragon',
            x: pos.x,
            y: pos.y,
            poi: 'Dragon Pit',
            label: isTeamRelevant ? 'Dragón (participaste)' : 'Dragón',
            detail: `Elite monster DRAGON en ${poi}.`,
            impact: 'Dragon',
          });
        } else if (monster.includes('BARON')) {
          events.push({
            t: et,
            type: 'baron',
            x: pos.x,
            y: pos.y,
            poi: 'Baron Pit',
            label: isTeamRelevant ? 'Barón (participaste)' : 'Barón',
            detail: `Elite monster BARON en ${poi}.`,
            impact: 'Baron',
          });
        } else {
          events.push({
            t: et,
            type: 'objective',
            x: pos.x,
            y: pos.y,
            poi,
            label: monster,
            detail: `Objetivo elite ${monster} en ${poi}.`,
            impact: 'Obj',
          });
        }
      } else if (event.type === 'BUILDING_KILL') {
        const involved =
          event.killerId === participantId ||
          event.assistingParticipantIds?.includes(participantId);
        if (involved) {
          events.push({
            t: et,
            type: 'turret',
            x: pos.x,
            y: pos.y,
            poi,
            label: event.towerType ? `Torre ${event.towerType}` : 'Estructura',
            detail: `Building kill (${event.buildingType ?? 'BUILDING'}) en ${poi}.`,
            impact: 'Torre',
          });
        }
      }
    }
  }

  if (path.length === 0) return null;

  const durationSec =
    durationSecHint && durationSecHint > 0
      ? durationSecHint
      : Math.max(path[path.length - 1].t, events.at(-1)?.t ?? 0, 60);

  // Spawn + cierre
  const start = path[0];
  events.unshift({
    t: 0,
    type: 'spawn',
    x: start.x,
    y: start.y,
    poi: nearestRiftPoi(start.x, start.y),
    label: 'Inicio de partida',
    detail: 'Primera posición registrada en Timeline-V5.',
    impact: 'Inicio',
  });
  const end = path[path.length - 1];
  events.push({
    t: durationSec,
    type: 'loot',
    x: end.x,
    y: end.y,
    poi: nearestRiftPoi(end.x, end.y),
    label: 'Cierre',
    detail: 'Última posición del timeline.',
    impact: 'Fin',
  });

  events.sort((a, b) => a.t - b.t);

  return {
    source: 'riot_timeline_v5',
    durationSec,
    path: dedupePath(path),
    events,
    participantId,
    coordinateSpace: { maxX: RIFT_MAX, maxY: RIFT_MAX },
  };
}

function riotToNorm(x: number, y: number): { x: number; y: number } {
  return {
    x: clamp01(x / RIFT_MAX),
    y: clamp01(1 - y / RIFT_MAX),
  };
}

function nearestRiftPoi(x: number, y: number): string {
  return RIFT_POIS.reduce((best, poi) => {
    const bestDist = Math.hypot(best.x - x, best.y - y);
    const poiDist = Math.hypot(poi.x - x, poi.y - y);
    return poiDist < bestDist ? poi : best;
  }).name;
}

function dedupePath(points: LolMapPoint[]): LolMapPoint[] {
  const seen = new Set<number>();
  return points.filter((point) => {
    if (seen.has(point.t)) return false;
    seen.add(point.t);
    return true;
  });
}

function clamp01(value: number): number {
  return Math.max(0.02, Math.min(0.98, value));
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

async function loadCursor(platformUserId: string): Promise<PollCursor | null> {
  const tableName = requireEnv('TABLE_NAME');
  const client = getDocumentClient();
  const result = await client.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: DynamoKeys.statsSnapshotPk(PLATFORM, platformUserId),
        SK: DynamoKeys.statsSnapshotSk(),
      },
    }),
  );
  if (!result.Item) return null;
  const seen = Array.isArray(result.Item['seenMatchIds'])
    ? result.Item['seenMatchIds'].map(String)
    : [];
  return {
    puuid: result.Item['puuid'] ? String(result.Item['puuid']) : undefined,
    seenMatchIds: seen,
  };
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
        puuid: cursor.puuid ?? null,
        seenMatchIds: cursor.seenMatchIds,
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
