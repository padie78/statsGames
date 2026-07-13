import { z } from 'zod';

export const GamePlatformSchema = z.enum([
  'fortnite',
  'roblox',
  'valorant',
  'league_of_legends',
  'cs2',
  'rocket_league',
]);

export const GameWebhookPayloadSchema = z
  .object({
    userId: z.string().min(1).optional(),
    platformUserId: z.string().min(1).optional(),
    matchId: z.string().min(1),
    /** Texto libre para la UI (ej. "Ranked Solo · Top 8"). */
    summary: z.string().min(1).max(200).optional(),
    mode: z.string().min(1).max(80).optional(),
    map: z.string().min(1).max(80).optional(),
    stats: z.record(z.unknown()).optional(),
    occurredAt: z.string().datetime().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.userId && !value.platformUserId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'userId o platformUserId es obligatorio.',
        path: ['userId'],
      });
    }
  });

export type GameWebhookPayloadDto = z.infer<typeof GameWebhookPayloadSchema>;
