import { Match } from '@stats-games/domain';
import { GameQueueMessageSchema } from '../../dto/ingestion/game-queue-message.dto';
import { MatchMapper } from '../../mappers/match.mapper';
import type { IMatchEventNotifier, IMatchWriter } from '../../ports/event-network/match.port';
import type { IStatsSummaryRepository } from '../../ports/event-network/stats-summary.repository.port';
import type { ILogger } from '../../ports/shared/logger.port';

export interface ProcessMatchFromQueueDeps {
  matchWriter: IMatchWriter;
  matchEventNotifier: IMatchEventNotifier;
  statsSummaryRepository?: IStatsSummaryRepository;
  logger?: ILogger;
}

export class ProcessMatchFromQueueUseCase {
  constructor(private readonly deps: ProcessMatchFromQueueDeps) {}

  async execute(raw: unknown): Promise<{ matchId: string; skippedDuplicate: boolean }> {
    const message = GameQueueMessageSchema.parse(raw);

    const match = Match.create({
      userId: message.userId,
      matchId: message.matchId,
      platform: message.platform,
      stats: message.stats,
      occurredAtIso: message.occurredAtIso,
      correlationId: message.correlationId,
    });

    let skippedDuplicate = false;

    try {
      await this.deps.matchWriter.save(match);
    } catch (error) {
      if ((error as { name?: string }).name === 'ConditionalCheckFailedException') {
        skippedDuplicate = true;
        this.deps.logger?.info('Partida ya persistida — idempotente', {
          matchId: message.matchId,
          userId: message.userId,
        });
      } else {
        throw error;
      }
    }

    if (!skippedDuplicate && this.deps.statsSummaryRepository) {
      await this.deps.statsSummaryRepository.aggregateMatchEvent(
        MatchMapper.toProcessedEvent(match),
      );
    }

    await this.deps.matchEventNotifier.publishMatchUpdate(match);

    this.deps.logger?.info('Partida procesada', {
      userId: message.userId,
      matchId: message.matchId,
      platform: message.platform,
      skippedDuplicate,
    });

    return { matchId: message.matchId, skippedDuplicate };
  }
}
