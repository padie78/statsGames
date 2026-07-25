import type { LeaderboardEntryDto } from '../../dto/event-network/community-stats.dto';
import type { ICommunityStatsRepository } from '../../ports/event-network/community-stats.repository.port';
import type { IPlayerProfileRepository } from '../../ports/player/player-profile.repository.port';
import { previousWeeklyPeriodId } from './stats-period.util';

/** Si la semana actual tiene pocos peers, completar con la semana anterior. */
const MIN_LEADERBOARD_SAMPLE = 5;

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

    const limit = input.limit ?? 20;
    const periodId = input.periodId.trim();
    let rows = await this.communityRepository.listWeeklyLeaderboard(
      input.platform,
      periodId,
      limit,
    );

    if (rows.length < MIN_LEADERBOARD_SAMPLE) {
      const previousId = previousWeeklyPeriodId(periodId);
      if (previousId) {
        const previous = await this.communityRepository.listWeeklyLeaderboard(
          input.platform,
          previousId,
          limit,
        );
        rows = mergeLeaderboardPreferCurrent(rows, previous).slice(0, limit);
      }
    }

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

/** Une dos leaderboards: la semana actual pisa a la anterior por userId; reordena por score. */
function mergeLeaderboardPreferCurrent(
  current: LeaderboardEntryDto[],
  previous: LeaderboardEntryDto[],
): LeaderboardEntryDto[] {
  const byUser = new Map<string, LeaderboardEntryDto>();
  for (const row of previous) {
    if (row.userId) byUser.set(row.userId, row);
  }
  for (const row of current) {
    if (row.userId) byUser.set(row.userId, row);
  }

  return [...byUser.values()]
    .sort((a, b) => b.score - a.score || b.totalKills - a.totalKills)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}
