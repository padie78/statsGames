/**
 * Claves DynamoDB para rollups de stats y telemetría de partidas.
 */

import type { GamePlatform } from './keys';

export type StatsGranularity = 'DAILY' | 'WEEKLY' | 'MONTHLY';

const TELEMETRY_PREFIX = 'TELEMETRY#';
const METRICS_PREFIX = 'METRICS#';

export function statsPlayerPk(userId: string): string {
  return `USER#${userId}`;
}

export function statsMetricsSk(granularity: StatsGranularity, periodId: string): string {
  return `${METRICS_PREFIX}${granularity}#${periodId}`;
}

const COMMUNITY_PREFIX = 'COMMUNITY#';
const LEADERBOARD_PREFIX = 'LEADERBOARD#';

export function communityBenchmarkPk(platform: GamePlatform): string {
  return `${COMMUNITY_PREFIX}${platform}`;
}

export function communityBenchmarkSk(periodId: string): string {
  return `BENCHMARK#WEEKLY#${periodId}`;
}

export function communityPlayerSeenSk(periodId: string, platform: GamePlatform): string {
  return `COMMUNITY_SEEN#WEEKLY#${periodId}#${platform}`;
}

export function leaderboardPk(platform: GamePlatform, periodId: string): string {
  return `${LEADERBOARD_PREFIX}${platform}#WEEKLY#${periodId}`;
}

export function leaderboardUserSk(userId: string): string {
  return `USER#${userId}`;
}

export function telemetryEventSk(occurredAtIso: string, correlationId: string): string {
  return `${TELEMETRY_PREFIX}${occurredAtIso}#${correlationId}`;
}

export function platformTimeGsi(
  platform: GamePlatform,
  occurredAtIso: string,
  correlationId: string,
): { GSI1PK: string; GSI1SK: string } {
  return {
    GSI1PK: `PLATFORM#${platform}#TIME`,
    GSI1SK: `${occurredAtIso}#${correlationId}`,
  };
}

export function telemetryTtlEpoch(fromDate: Date = new Date(), retentionDays = 90): number {
  return Math.floor(fromDate.getTime() / 1000) + retentionDays * 86_400;
}
