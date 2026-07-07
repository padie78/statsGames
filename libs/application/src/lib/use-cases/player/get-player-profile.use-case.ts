import { PlayerNotFoundError } from '@stats-games/domain';
import { PlayerProfileMapper } from '../../mappers/player-profile.mapper';
import type { IPlayerProfileRepository } from '../../ports/player/player-profile.repository.port';

export class GetPlayerProfileUseCase {
  constructor(private readonly repository: IPlayerProfileRepository) {}

  async execute(input: { userId: string }) {
    if (!input.userId?.trim()) {
      throw new Error('userId requerido.');
    }

    const profile = await this.repository.findByUserId(input.userId.trim());
    if (!profile) {
      throw new PlayerNotFoundError(input.userId);
    }

    return PlayerProfileMapper.toDto(profile);
  }
}
