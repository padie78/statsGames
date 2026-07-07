import { z } from 'zod';

export const GamePlatformSchema = z.enum(['fortnite', 'roblox']);

export const GameWebhookPayloadSchema = z
  .object({
    userId: z.string().min(1).optional(),
    platformUserId: z.string().min(1).optional(),
    matchId: z.string().min(1),
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
