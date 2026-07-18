import type { ICommunityStatsRepository } from '../../ports/event-network/community-stats.repository.port';
import type { IPlayerProfileRepository } from '../../ports/player/player-profile.repository.port';

export class ListWeeklyLeaderboardUseCase {
  constructor(
    private readonly communityRepository: ICommunityStatsRepository,
    private readonly playerProfiles: IPlayerProfileRepository,
  ) {}

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
    limit?: number;
  }) {
    if (!input.periodId?.trim()) throw new Error('periodId requerido.');

    const rows = await this.communityRepository.listWeeklyLeaderboard(
      input.platform,
      input.periodId.trim(),
      input.limit ?? 20,
    );

    const enriched = await Promise.all(
      rows.map(async (row) => {
        const profile = await this.playerProfiles.findByUserId(row.userId);
        return {
          ...row,
          gamerTag: profile?.gamerTag ?? row.gamerTag,
          avatarUrl: profile?.avatarUrl ?? row.avatarUrl,
        };
      }),
    );

    return enriched;
  }
}
