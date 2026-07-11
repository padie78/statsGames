import { z } from 'zod';
import type { StatsGranularity } from '@stats-games/common';
import { GamePlatformSchema } from '../ingestion/game-webhook.dto';

export const ProcessedMatchEventSchema = z.object({
  userId: z.string().min(1),
  matchId: z.string().min(1),
  platform: GamePlatformSchema,
  occurredAtIso: z.string().min(1),
  correlationId: z.string().min(1),
  stats: z.record(z.unknown()).default({}),
});

export type ProcessedMatchEventDto = z.infer<typeof ProcessedMatchEventSchema>;

export interface MatchStatsKpisDto {
  match_count: number;
  total_kills: number;
  total_deaths: number;
  avg_placement: number;
}

export interface MatchStatsRollupDto {
  userId: string;
  platform: 'fortnite' | 'roblox' | 'valorant' | 'rocket_league';
  granularity: StatsGranularity;
  periodId: string;
  kpis: MatchStatsKpisDto;
  versionId: number;
  lastUpdatedIso: string;
}

export interface AggregateMatchStatsResultDto {
  matchId: string;
  rollupsUpdated: StatsGranularity[];
  skippedDuplicate: boolean;
}
