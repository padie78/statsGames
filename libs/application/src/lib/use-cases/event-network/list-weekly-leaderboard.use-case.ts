import type { ICommunityStatsRepository } from '../../ports/event-network/community-stats.repository.port';
import type { IPlayerProfileRepository } from '../../ports/player/player-profile.repository.port';

export class ListWeeklyLeaderboardUseCase {
  constructor(
    private readonly communityRepository: ICommunityStatsRepository,
    private readonly playerProfiles: IPlayerProfileRepository,
  ) {}

  async execute(input: {
    platform: 'fortnite' | 'roblox' | 'valorant' | 'rocket_league';
    periodId: string;
    limit?: number;
  }) {
    if (!input.periodId?.trim()) throw new Error('periodId requerido.');

    const rows = await this.communityRepository.listWeeklyLeaderboard(
      input.platform,
      input.periodId.trim(),
      input.limit ?? 5,
    );

    const enriched = await Promise.all(
      rows.map(async (row) => {
        const profile = await this.playerProfiles.findByUserId(row.userId);
        return {
          ...row,
          gamerTag: profile?.gamerTag ?? row.gamerTag,
        };
      }),
    );

    return enriched;
  }
}
