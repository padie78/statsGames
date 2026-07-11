import { PlayerProfile } from '@stats-games/domain';
import { UpsertPlayerProfileInputSchema } from '../../dto/player/player-profile.dto';
import { PlayerProfileMapper } from '../../mappers/player-profile.mapper';
import type { ILogger } from '../../ports/shared/logger.port';
import type { IPlayerProfileRepository } from '../../ports/player/player-profile.repository.port';

export interface UpsertPlayerProfileDeps {
  repository: IPlayerProfileRepository;
  logger?: ILogger;
}

export class UpsertPlayerProfileUseCase {
  constructor(private readonly deps: UpsertPlayerProfileDeps) {}

  async execute(input: unknown) {
    const parsed = UpsertPlayerProfileInputSchema.parse(input);
    const existing = await this.deps.repository.findByUserId(parsed.userId);

    const profile = existing
      ? existing.update({
          gamerTag: parsed.gamerTag,
          primaryPlatform: parsed.primaryPlatform,
          fortniteId: parsed.fortniteId,
          robloxId: parsed.robloxId,
          valorantId: parsed.valorantId,
          rocketLeagueId: parsed.rocketLeagueId,
          avatarUrl: parsed.avatarUrl,
        })
      : PlayerProfile.create({
          userId: parsed.userId,
          gamerTag: parsed.gamerTag,
          primaryPlatform: parsed.primaryPlatform,
          fortniteId: parsed.fortniteId,
          robloxId: parsed.robloxId,
          valorantId: parsed.valorantId,
          rocketLeagueId: parsed.rocketLeagueId,
          avatarUrl: parsed.avatarUrl,
        });

    await this.deps.repository.save(profile);

    this.deps.logger?.info('Perfil de jugador guardado', {
      userId: profile.userId,
      versionId: profile.versionId,
    });

    return PlayerProfileMapper.toDto(profile);
  }
}
