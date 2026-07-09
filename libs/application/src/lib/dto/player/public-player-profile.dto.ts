import { z } from 'zod';
import { GamePlatformSchema } from '../ingestion/game-webhook.dto';

export const PublicPlayerProfileDtoSchema = z.object({
  userId: z.string().min(1),
  gamerTag: z.string().min(1),
  primaryPlatform: GamePlatformSchema,
  avatarUrl: z.string().optional(),
  createdAtIso: z.string().min(1),
});

export type PublicPlayerProfileDto = z.infer<typeof PublicPlayerProfileDtoSchema>;

export const PlayerSearchHitDtoSchema = z.object({
  userId: z.string().min(1),
  gamerTag: z.string().min(1),
  primaryPlatform: GamePlatformSchema,
  avatarUrl: z.string().optional(),
});

export type PlayerSearchHitDto = z.infer<typeof PlayerSearchHitDtoSchema>;
