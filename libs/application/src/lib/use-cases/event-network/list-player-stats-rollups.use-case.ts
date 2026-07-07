import type { StatsGranularity } from '@stats-games/common';
import type { IStatsRollupReader } from '../../ports/event-network/stats-summary.repository.port';

export class ListPlayerStatsRollupsUseCase {
  constructor(private readonly reader: IStatsRollupReader) {}

  async execute(input: {
    userId: string;
    granularity: StatsGranularity;
    periodId: string;
    platform?: 'fortnite' | 'roblox';
    limit?: number;
  }) {
    if (!input.userId?.trim()) throw new Error('userId requerido.');
    if (!input.periodId?.trim()) throw new Error('periodId requerido.');

    return this.reader.listByPlayerGranularity(
      input.userId.trim(),
      input.granularity,
      input.periodId.trim(),
      { platform: input.platform, limit: input.limit ?? 100 },
    );
  }
}
