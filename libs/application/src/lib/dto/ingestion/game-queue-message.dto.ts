import { z } from 'zod';
import { GamePlatformSchema } from './game-webhook.dto';

export const GameQueueMessageSchema = z.object({
  userId: z.string().min(1),
  matchId: z.string().min(1),
  platform: GamePlatformSchema,
  stats: z.record(z.unknown()).default({}),
  occurredAtIso: z.string().min(1),
  correlationId: z.string().min(1),
});

export type GameQueueMessageDto = z.infer<typeof GameQueueMessageSchema>;
