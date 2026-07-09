import type { PlayerSearchHitDto } from '../../dto/player/public-player-profile.dto';
import { PlayerProfileMapper } from '../../mappers/player-profile.mapper';
import type { IPlayerProfileRepository } from '../../ports/player/player-profile.repository.port';

export class SearchPlayersUseCase {
  constructor(private readonly repository: IPlayerProfileRepository) {}

  async execute(input: { query: string; limit?: number }): Promise<PlayerSearchHitDto[]> {
    const query = input.query?.trim();
    if (!query || query.length < 2) {
      return [];
    }

    const profiles = await this.repository.searchByGamerTagPrefix(query, input.limit ?? 10);
    return profiles.map((profile) => PlayerProfileMapper.toSearchHit(profile));
  }
}
