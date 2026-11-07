import { MatchMapper } from '../../mappers/match.mapper';
import type { IMatchReader } from '../../ports/event-network/match.port';

export class GetPlayerMatchUseCase {
  constructor(private readonly matchReader: IMatchReader) {}

  async execute(input: { userId: string; matchId: string }) {
    const userId = input.userId?.trim();
    const matchId = input.matchId?.trim();
    if (!userId) throw new Error('userId requerido.');
    if (!matchId) throw new Error('matchId requerido.');

    if (!this.matchReader.getByUserAndMatchId) {
      const recent = await this.matchReader.listByUser(userId, { limit: 200 });
      const found = recent.find((m) => m.matchId === matchId) ?? null;
      return found ? MatchMapper.toUpdateDto(found) : null;
    }

    const match = await this.matchReader.getByUserAndMatchId(userId, matchId);
    return match ? MatchMapper.toUpdateDto(match) : null;
  }
}
