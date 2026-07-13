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
