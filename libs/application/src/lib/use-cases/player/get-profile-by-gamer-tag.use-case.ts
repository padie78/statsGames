import { PlayerNotFoundError } from '@stats-games/domain';
import type { PublicPlayerProfileDto } from '../../dto/player/public-player-profile.dto';
import { PlayerProfileMapper } from '../../mappers/player-profile.mapper';
import type { IPlayerProfileRepository } from '../../ports/player/player-profile.repository.port';

export class GetProfileByGamerTagUseCase {
  constructor(private readonly repository: IPlayerProfileRepository) {}

  async execute(input: { gamerTag: string }): Promise<PublicPlayerProfileDto> {
    const gamerTag = input.gamerTag?.trim();
    if (!gamerTag) {
      throw new Error('gamerTag requerido.');
    }

    const profile = await this.repository.findByGamerTag(gamerTag);
    if (!profile) {
      throw new PlayerNotFoundError(gamerTag);
    }

    return PlayerProfileMapper.toPublicDto(profile);
  }
}
