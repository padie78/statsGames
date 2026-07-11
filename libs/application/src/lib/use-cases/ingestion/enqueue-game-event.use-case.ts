import { Platform, PlatformAccountNotLinkedError } from '@stats-games/domain';
import type { IGameIngestionQueuePublisher } from '@stats-games/domain';
import {
  GameWebhookPayloadSchema,
  type GameWebhookPayloadDto,
} from '../../dto/ingestion/game-webhook.dto';
import type { IPlatformAccountResolver } from '../../ports/player/platform-account-resolver.port';
import type { ILogger } from '../../ports/shared/logger.port';

export interface EnqueueGameEventInput {
  platform: string;
  payload: unknown;
  correlationId: string;
}

export interface EnqueueGameEventDeps {
  queuePublisher: IGameIngestionQueuePublisher;
  platformAccountResolver?: IPlatformAccountResolver;
  webhookSecret?: string;
  logger?: ILogger;
}

export class EnqueueGameEventUseCase {
  constructor(private readonly deps: EnqueueGameEventDeps) {}

  async execute(input: EnqueueGameEventInput): Promise<{ correlationId: string }> {
    const platform = Platform.from(input.platform);
    const payload: GameWebhookPayloadDto = GameWebhookPayloadSchema.parse(input.payload);
    const userId = await this.resolveUserId(platform.value, payload);

    const stats: Record<string, unknown> = { ...(payload.stats ?? {}) };
    if (payload.summary) stats['summary'] = payload.summary;
    if (payload.mode) stats['mode'] = payload.mode;
    if (payload.map) stats['map'] = payload.map;

    const message = {
      userId,
      matchId: payload.matchId,
      platform: platform.value,
      stats,
      occurredAtIso: payload.occurredAt ?? new Date().toISOString(),
      correlationId: input.correlationId,
    };

    await this.deps.queuePublisher.enqueue(message);

    this.deps.logger?.info('Evento de juego encolado', {
      platform: platform.value,
      userId: payload.userId,
      matchId: payload.matchId,
      correlationId: input.correlationId,
    });

    return { correlationId: input.correlationId };
  }

  private async resolveUserId(
    platform: Platform['value'],
    payload: GameWebhookPayloadDto,
  ): Promise<string> {
    if (payload.userId) {
      return payload.userId;
    }

    const externalId = payload.platformUserId;
    if (!externalId) {
      throw new Error('resolveUserId: platformUserId requerido cuando userId está ausente.');
    }

    const resolver = this.deps.platformAccountResolver;
    if (!resolver) {
      throw new PlatformAccountNotLinkedError(platform, externalId);
    }

    const userId = await resolver.findUserIdByPlatformAccount(platform, externalId);
    if (!userId) {
      throw new PlatformAccountNotLinkedError(platform, externalId);
    }

    return userId;
  }

  validateWebhookSecret(headers: Record<string, string | undefined>): boolean {
    const secret = this.deps.webhookSecret;
    if (!secret) return true;
    const provided = headers['x-webhook-secret'];
    return provided === secret;
  }
}
