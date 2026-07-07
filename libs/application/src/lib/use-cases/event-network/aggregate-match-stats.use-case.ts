import type { ILogger } from '../../ports/shared/logger.port';
import type { IStatsSummaryRepository } from '../../ports/event-network/stats-summary.repository.port';
import { ProcessedMatchEventSchema } from '../../dto/event-network/player-stats.dto';

export interface AggregateMatchStatsDeps {
  statsSummaryRepository: IStatsSummaryRepository;
  logger?: ILogger;
}

/**
 * Materializa rollups de STATS_SUMMARY tras persistir una partida.
 * Idempotente por matchId + granularity.
 */
export class AggregateMatchStatsUseCase {
  constructor(private readonly deps: AggregateMatchStatsDeps) {}

  async execute(raw: unknown) {
    const event = ProcessedMatchEventSchema.parse(raw);
    const result = await this.deps.statsSummaryRepository.aggregateMatchEvent(event);

    if (result.skippedDuplicate) {
      this.deps.logger?.info('Stats ya agregadas (match duplicado)', {
        userId: event.userId,
        matchId: event.matchId,
      });
    } else {
      this.deps.logger?.info('Rollups de stats actualizados', {
        userId: event.userId,
        matchId: event.matchId,
        rollups: result.rollupsUpdated,
      });
    }

    return result;
  }
}
