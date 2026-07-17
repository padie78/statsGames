import type { ICommunityStatsRepository } from '../../ports/event-network/community-stats.repository.port';

export class GetCommunityBenchmarksUseCase {
  constructor(private readonly repository: ICommunityStatsRepository) {}

  async execute(input: {
    platform:
      | 'fortnite'
      | 'roblox'
      | 'valorant'
      | 'league_of_legends'
      | 'cs2'
      | 'dota2'
      | 'overwatch2'
      | 'rocket_league'
      | 'clash_royale'
      | 'brawl_stars';
    periodId: string;
  }) {
    if (!input.periodId?.trim()) throw new Error('periodId requerido.');
    return this.repository.getCommunityBenchmarks(input.platform, input.periodId.trim());
  }
}
