import type { GamePlatform } from '../value-objects/platform';

export interface GameIngestionWorkMessage {
  userId: string;
  matchId: string;
  platform: GamePlatform;
  stats: Record<string, unknown>;
  occurredAtIso: string;
  correlationId: string;
}

export interface IGameIngestionQueuePublisher {
  enqueue(message: GameIngestionWorkMessage): Promise<void>;
}
