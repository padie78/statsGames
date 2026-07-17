import { z } from 'zod';
import { GamePlatformSchema } from '../ingestion/game-webhook.dto';

export const MatchStatsDtoSchema = z.object({
  kills: z.number().int().nonnegative().optional(),
  deaths: z.number().int().nonnegative().optional(),
  placement: z.number().int().nonnegative().optional(),
  assists: z.number().int().nonnegative().optional(),
  headshotPct: z.number().nonnegative().optional(),
  roundsWon: z.number().int().nonnegative().optional(),
  roundsLost: z.number().int().nonnegative().optional(),
  map: z.string().min(1).optional(),
  agent: z.string().min(1).optional(),
  mode: z.string().min(1).optional(),
  won: z.boolean().optional(),
  score: z.number().int().nonnegative().optional(),
  adr: z.number().nonnegative().optional(),
  champion: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  cs: z.number().int().nonnegative().optional(),
  visionScore: z.number().int().nonnegative().optional(),
  goals: z.number().int().nonnegative().optional(),
  saves: z.number().int().nonnegative().optional(),
  shots: z.number().int().nonnegative().optional(),
  shotPct: z.number().nonnegative().optional(),
  durationSec: z.number().int().nonnegative().optional(),
  goldEarned: z.number().int().nonnegative().optional(),
  champLevel: z.number().int().nonnegative().optional(),
  teamBarons: z.number().int().nonnegative().optional(),
  teamDragons: z.number().int().nonnegative().optional(),
  teamTowers: z.number().int().nonnegative().optional(),
});

export type MatchStatsDto = z.infer<typeof MatchStatsDtoSchema>;

export const MatchUpdateDtoSchema = z.object({
  userId: z.string().min(1),
  matchId: z.string().min(1),
  platform: GamePlatformSchema,
  summary: z.string().min(1),
  updatedAt: z.string().min(1),
  stats: MatchStatsDtoSchema.optional(),
});

export type MatchUpdateDto = z.infer<typeof MatchUpdateDtoSchema>;
