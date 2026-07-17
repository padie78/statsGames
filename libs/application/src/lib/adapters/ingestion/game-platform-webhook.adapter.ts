import type { GamePlatform } from '@stats-games/common';
import type { GameWebhookPayloadDto } from '../../dto/ingestion/game-webhook.dto';

export interface NormalizedGameWebhookEvent {
  matchId: string;
  stats: Record<string, unknown>;
  occurredAtIso: string;
}

type StatBuilder = (payload: GameWebhookPayloadDto) => Record<string, unknown>;

const PLATFORM_LABEL: Record<GamePlatform, string> = {
  valorant: 'Valorant',
  league_of_legends: 'League of Legends',
  cs2: 'CS2',
  dota2: 'Dota 2',
  overwatch2: 'Overwatch 2',
  rocket_league: 'Rocket League',
  fortnite: 'Fortnite',
  clash_royale: 'Clash Royale',
  brawl_stars: 'Brawl Stars',
  roblox: 'Roblox',
};

const DEFAULT_MODE: Partial<Record<GamePlatform, string>> = {
  valorant: 'Competitive',
  league_of_legends: 'Ranked Solo',
  cs2: 'Premier',
  dota2: 'Ranked',
  overwatch2: 'Competitive',
  rocket_league: '2v2',
  fortnite: 'Battle Royale',
  clash_royale: 'Ladder',
  brawl_stars: 'Gem Grab',
  roblox: 'BedWars',
};

const STAT_BUILDERS: Record<GamePlatform, StatBuilder> = {
  valorant: (payload) => ({
    kills: numberStat(payload, 'kills'),
    deaths: numberStat(payload, 'deaths'),
    assists: numberStat(payload, 'assists'),
    headshotPct: numberStat(payload, 'headshotPct', 'hsPct', 'hs'),
    roundsWon: numberStat(payload, 'roundsWon', 'rounds-won'),
    roundsLost: numberStat(payload, 'roundsLost', 'rounds-lost'),
    agent: stringStat(payload, 'agent'),
    score: numberStat(payload, 'score'),
    acs: numberStat(payload, 'acs'),
    won: booleanStat(payload, 'won'),
  }),
  league_of_legends: (payload) => ({
    kills: numberStat(payload, 'kills'),
    deaths: numberStat(payload, 'deaths'),
    assists: numberStat(payload, 'assists'),
    champion: stringStat(payload, 'champion'),
    role: stringStat(payload, 'role'),
    cs: numberStat(payload, 'cs'),
    visionScore: numberStat(payload, 'visionScore', 'vision'),
    queueId: numberStat(payload, 'queueId', 'queue-id'),
    won: booleanStat(payload, 'won'),
  }),
  cs2: (payload) => ({
    kills: numberStat(payload, 'kills'),
    deaths: numberStat(payload, 'deaths'),
    assists: numberStat(payload, 'assists'),
    adr: numberStat(payload, 'adr'),
    headshotPct: numberStat(payload, 'headshotPct', 'hsPct', 'hs'),
    won: booleanStat(payload, 'won'),
  }),
  dota2: (payload) => ({
    kills: numberStat(payload, 'kills'),
    deaths: numberStat(payload, 'deaths'),
    assists: numberStat(payload, 'assists'),
    hero: stringStat(payload, 'hero'),
    gpm: numberStat(payload, 'gpm'),
    xpm: numberStat(payload, 'xpm'),
    won: booleanStat(payload, 'won'),
  }),
  overwatch2: (payload) => ({
    kills: numberStat(payload, 'kills'),
    deaths: numberStat(payload, 'deaths'),
    assists: numberStat(payload, 'assists'),
    hero: stringStat(payload, 'hero'),
    role: stringStat(payload, 'role'),
    damage: numberStat(payload, 'damage'),
    healing: numberStat(payload, 'healing'),
    won: booleanStat(payload, 'won'),
  }),
  rocket_league: (payload) => {
    const goals = numberStat(payload, 'goals') ?? numberStat(payload, 'kills') ?? 0;
    return {
      goals,
      kills: goals,
      assists: numberStat(payload, 'assists'),
      saves: numberStat(payload, 'saves'),
      shots: numberStat(payload, 'shots'),
      shotPct: numberStat(payload, 'shotPct', 'shot-pct'),
      score: numberStat(payload, 'score'),
      won: booleanStat(payload, 'won'),
    };
  },
  fortnite: (payload) => ({
    kills: numberStat(payload, 'kills'),
    deaths: numberStat(payload, 'deaths'),
    assists: numberStat(payload, 'assists'),
    placement: numberStat(payload, 'placement'),
    won: booleanStat(payload, 'won'),
  }),
  clash_royale: (payload) => ({
    crowns: numberStat(payload, 'crowns'),
    trophies: numberStat(payload, 'trophies'),
    score: numberStat(payload, 'score'),
    won: booleanStat(payload, 'won'),
    kills: numberStat(payload, 'crowns') ?? 0,
    deaths: 0,
  }),
  brawl_stars: (payload) => ({
    kills: numberStat(payload, 'kills'),
    deaths: numberStat(payload, 'deaths'),
    assists: numberStat(payload, 'assists'),
    brawler: stringStat(payload, 'brawler'),
    trophies: numberStat(payload, 'trophies'),
    won: booleanStat(payload, 'won'),
  }),
  roblox: (payload) => ({
    kills: numberStat(payload, 'kills'),
    deaths: numberStat(payload, 'deaths'),
    placement: numberStat(payload, 'placement'),
    experienceName: stringStat(payload, 'experienceName', 'placeName'),
    experienceId: stringStat(payload, 'experienceId'),
    placeId: stringStat(payload, 'placeId'),
    universeId: stringStat(payload, 'universeId'),
    badgeId: stringStat(payload, 'badgeId'),
    badgeName: stringStat(payload, 'badgeName'),
  }),
};

export function normalizeGameWebhookEvent(
  platform: GamePlatform,
  payload: GameWebhookPayloadDto,
): NormalizedGameWebhookEvent {
  const mode = payload.mode ?? stringStat(payload, 'mode') ?? DEFAULT_MODE[platform];
  const map = payload.map ?? stringStat(payload, 'map');
  const baseStats = stripUndefined({
    ...(payload.stats ?? {}),
    ...STAT_BUILDERS[platform](payload),
    ...(mode ? { mode } : {}),
    ...(map ? { map } : {}),
    source: stringStat(payload, 'source') ?? 'webhook_adapter',
  });
  const summary = payload.summary ?? stringStat(payload, 'summary') ?? buildSummary(platform, baseStats);

  return {
    matchId: payload.matchId,
    stats: stripUndefined({
      ...baseStats,
      ...(summary ? { summary } : {}),
    }),
    occurredAtIso: payload.occurredAt ?? new Date().toISOString(),
  };
}

function buildSummary(platform: GamePlatform, stats: Record<string, unknown>): string {
  const parts = [
    PLATFORM_LABEL[platform],
    asText(stats['mode']),
    asText(stats['map']),
    resultText(stats),
    performanceText(platform, stats),
  ];
  return parts.filter(Boolean).join(' · ').slice(0, 200);
}

function performanceText(platform: GamePlatform, stats: Record<string, unknown>): string | undefined {
  if (platform === 'rocket_league') {
    return `${asNumber(stats['goals']) ?? 0}G ${asNumber(stats['assists']) ?? 0}A`;
  }
  if (platform === 'clash_royale') {
    return `${asNumber(stats['crowns']) ?? 0} coronas`;
  }
  const kills = asNumber(stats['kills']);
  const deaths = asNumber(stats['deaths']);
  const assists = asNumber(stats['assists']);
  if (kills == null && deaths == null && assists == null) return undefined;
  return [kills ?? 0, deaths ?? 0, assists].filter((value) => value != null).join('/');
}

function resultText(stats: Record<string, unknown>): string | undefined {
  const won = asBoolean(stats['won']);
  if (won === true) return 'Victoria';
  if (won === false) return 'Derrota';
  const placement = asNumber(stats['placement']);
  return placement != null ? `Top ${placement}` : undefined;
}

function numberStat(payload: GameWebhookPayloadDto, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = statValue(payload, key);
    const parsed = asNumber(value);
    if (parsed != null) return parsed;
  }
  return undefined;
}

function stringStat(payload: GameWebhookPayloadDto, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = statValue(payload, key);
    const parsed = asText(value);
    if (parsed) return parsed;
  }
  return undefined;
}

function booleanStat(payload: GameWebhookPayloadDto, ...keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = statValue(payload, key);
    const parsed = asBoolean(value);
    if (parsed != null) return parsed;
  }
  return undefined;
}

function statValue(payload: GameWebhookPayloadDto, key: string): unknown {
  if (!payload.stats) return undefined;
  return payload.stats[key];
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'win', 'victoria'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'loss', 'derrota'].includes(normalized)) return false;
  return undefined;
}

function stripUndefined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
}
