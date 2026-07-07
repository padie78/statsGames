import type { GamePlatform } from '@stats-games/domain';
import { MatchMapper } from '../../mappers/match.mapper';
import type { IMatchReader } from '../../ports/event-network/match.port';

export class ListPlayerMatchesUseCase {
  constructor(private readonly matchReader: IMatchReader) {}

  async execute(input: {
    userId: string;
    platform?: GamePlatform;
    limit?: number;
  }) {
    if (!input.userId?.trim()) {
      throw new Error('userId requerido.');
    }

    const matches = await this.matchReader.listByUser(input.userId.trim(), {
      platform: input.platform,
      limit: input.limit ?? 50,
    });

    return matches.map((match) => MatchMapper.toUpdateDto(match));
  }
}
