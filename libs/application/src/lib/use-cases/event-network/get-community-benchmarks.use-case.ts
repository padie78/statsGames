import type { ICommunityStatsRepository } from '../../ports/event-network/community-stats.repository.port';

export class GetCommunityBenchmarksUseCase {
  constructor(private readonly repository: ICommunityStatsRepository) {}

  async execute(input: { platform: 'fortnite' | 'roblox' | 'valorant' | 'rocket_league'; periodId: string }) {
    if (!input.periodId?.trim()) throw new Error('periodId requerido.');
    return this.repository.getCommunityBenchmarks(input.platform, input.periodId.trim());
  }
}
