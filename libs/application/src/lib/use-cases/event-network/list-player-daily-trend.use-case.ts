import type { StatsGranularity } from '@stats-games/common';
import type { MatchStatsRollupDto } from '../../dto/event-network/player-stats.dto';
import type { IStatsRollupReader } from '../../ports/event-network/stats-summary.repository.port';

export class ListPlayerDailyTrendUseCase {
  constructor(private readonly reader: IStatsRollupReader) {}

  async execute(input: {
    userId: string;
    platform?: 'fortnite' | 'roblox';
    days?: number;
  }): Promise<MatchStatsRollupDto[]> {
    if (!input.userId?.trim()) throw new Error('userId requerido.');

    return this.reader.listRecentDailyRollups(input.userId.trim(), {
      platform: input.platform,
      days: input.days ?? 7,
    });
  }
}
