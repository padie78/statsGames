import { z } from 'zod';
import { GamePlatformSchema } from '../ingestion/game-webhook.dto';

export const MatchUpdateDtoSchema = z.object({
  userId: z.string().min(1),
  matchId: z.string().min(1),
  platform: GamePlatformSchema,
  summary: z.string().min(1),
  updatedAt: z.string().min(1),
});

export type MatchUpdateDto = z.infer<typeof MatchUpdateDtoSchema>;
