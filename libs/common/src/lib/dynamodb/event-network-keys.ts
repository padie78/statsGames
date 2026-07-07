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
