import type { Match } from '@stats-games/domain';
import type { MatchStatsDto, MatchUpdateDto } from '../dto/event-network/match-update.dto';

function toOptionalInt(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : undefined;
}

function toOptionalFloat(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : undefined;
}

function toOptionalString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s.length > 0 ? s : undefined;
}

function toOptionalBool(value: unknown): boolean | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  return undefined;
}

function extractStats(record: Record<string, unknown>): MatchStatsDto | undefined {
  const kills = toOptionalInt(record['kills'] ?? record['eliminations'] ?? record['goals']);
  const deaths = toOptionalInt(record['deaths']);
  const placement = toOptionalInt(record['placement'] ?? record['rank']);
  const assists = toOptionalInt(record['assists']);
  const headshotPct = toOptionalFloat(record['headshotPct'] ?? record['hsPct']);
  const roundsWon = toOptionalInt(record['roundsWon']);
  const roundsLost = toOptionalInt(record['roundsLost']);
  const map = toOptionalString(record['map']);
  const champion = toOptionalString(record['champion']);
  const agent = toOptionalString(record['agent']) ?? champion;
  const mode = toOptionalString(record['mode'] ?? record['playlist']);
  const won = toOptionalBool(record['won']);
  const score = toOptionalInt(record['score'] ?? record['acs']);
  const adr = toOptionalFloat(record['adr'] ?? record['damagePerRound']);
  const role = toOptionalString(record['role'] ?? record['teamPosition'] ?? record['lane']);
  const cs = toOptionalInt(record['cs'] ?? record['totalMinionsKilled']);
  const visionScore = toOptionalInt(record['visionScore']);
  const goals = toOptionalInt(record['goals']);
  const saves = toOptionalInt(record['saves']);
  const shots = toOptionalInt(record['shots']);
  const shotPct = toOptionalFloat(record['shotPct']);
  const durationSec = toOptionalInt(record['durationSec'] ?? record['gameLength']);

  // Rocket League: goals actúan como "kills" en KPIs genéricos.
  const resolvedKills = kills ?? goals;

  const hasAny =
    resolvedKills != null ||
    deaths != null ||
    placement != null ||
    assists != null ||
    headshotPct != null ||
    roundsWon != null ||
    roundsLost != null ||
    map != null ||
    agent != null ||
    mode != null ||
    won != null ||
    score != null ||
    adr != null ||
    champion != null ||
    role != null ||
    cs != null ||
    visionScore != null ||
    goals != null ||
    saves != null ||
    shots != null ||
    shotPct != null ||
    durationSec != null;

  if (!hasAny) return undefined;

  return {
    kills: resolvedKills,
    deaths,
    placement,
    assists,
    headshotPct,
    roundsWon,
    roundsLost,
    map,
    agent,
    mode,
    won,
    score,
    adr,
    champion,
    role,
    cs,
    visionScore,
    goals,
    saves,
    shots,
    shotPct,
    durationSec,
  };
}

export const MatchMapper = {
  toUpdateDto(match: Match): MatchUpdateDto {
    const stats = extractStats(match.stats.toRecord());
    return {
      userId: match.userId,
      matchId: match.matchId,
      platform: match.platform,
      summary: match.summary(),
      updatedAt: match.occurredAtIso,
      stats,
    };
  },

  toProcessedEvent(match: Match): {
    userId: string;
    matchId: string;
    platform: Match['platform'];
    occurredAtIso: string;
    correlationId: string;
    stats: Record<string, unknown>;
  } {
    return {
      userId: match.userId,
      matchId: match.matchId,
      platform: match.platform,
      occurredAtIso: match.occurredAtIso,
      correlationId: match.correlationId,
      stats: match.stats.toRecord(),
    };
  },
};
