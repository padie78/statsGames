import { Platform, PlayerNotFoundError } from '@stats-games/domain';
import { LinkPlatformAccountInputSchema } from '../../dto/player/player-profile.dto';
import { PlayerProfileMapper } from '../../mappers/player-profile.mapper';
import type { ILogger } from '../../ports/shared/logger.port';
import type { IPlayerProfileRepository } from '../../ports/player/player-profile.repository.port';

export interface LinkPlatformAccountDeps {
  repository: IPlayerProfileRepository;
  logger?: ILogger;
}

export class LinkPlatformAccountUseCase {
  constructor(private readonly deps: LinkPlatformAccountDeps) {}

  async execute(input: unknown) {
    const parsed = LinkPlatformAccountInputSchema.parse(input);
    const platform = Platform.from(parsed.platform);

    const existing = await this.deps.repository.findByUserId(parsed.userId);
    if (!existing) {
      throw new PlayerNotFoundError(parsed.userId);
    }

    const updated = existing.linkPlatform(platform.value, parsed.externalId);
    await this.deps.repository.save(updated);

    this.deps.logger?.info('Cuenta de plataforma vinculada', {
      userId: updated.userId,
      platform: platform.value,
    });

    return PlayerProfileMapper.toDto(updated);
  }
}
