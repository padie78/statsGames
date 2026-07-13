import { z } from 'zod';
import { GamePlatformSchema } from '../ingestion/game-webhook.dto';

export const PlayerProfileDtoSchema = z.object({
  userId: z.string().min(1),
  gamerTag: z.string().min(1).max(64),
  primaryPlatform: GamePlatformSchema,
  fortniteId: z.string().optional(),
  robloxId: z.string().optional(),
  valorantId: z.string().optional(),
  leagueOfLegendsId: z.string().optional(),
  cs2Id: z.string().optional(),
  rocketLeagueId: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  createdAtIso: z.string().min(1),
  updatedAtIso: z.string().min(1),
  versionId: z.number().int().positive(),
});

export type PlayerProfileDto = z.infer<typeof PlayerProfileDtoSchema>;

export const UpsertPlayerProfileInputSchema = z.object({
  userId: z.string().min(1),
  gamerTag: z.string().min(1).max(64),
  primaryPlatform: GamePlatformSchema,
  fortniteId: z.string().optional(),
  robloxId: z.string().optional(),
  valorantId: z.string().optional(),
  leagueOfLegendsId: z.string().optional(),
  cs2Id: z.string().optional(),
  rocketLeagueId: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

export type UpsertPlayerProfileInputDto = z.infer<typeof UpsertPlayerProfileInputSchema>;

export const LinkPlatformAccountInputSchema = z.object({
  userId: z.string().min(1),
  platform: GamePlatformSchema,
  externalId: z.string().min(1).max(128),
});

export type LinkPlatformAccountInputDto = z.infer<typeof LinkPlatformAccountInputSchema>;
