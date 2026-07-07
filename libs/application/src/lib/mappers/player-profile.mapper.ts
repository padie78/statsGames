import { PlayerProfile } from '@stats-games/domain';
import type { PlayerProfileDto } from '../dto/player/player-profile.dto';

export const PlayerProfileMapper = {
  toDto(profile: PlayerProfile): PlayerProfileDto {
    return {
      userId: profile.userId,
      gamerTag: profile.gamerTag,
      primaryPlatform: profile.primaryPlatform,
      fortniteId: profile.fortniteId,
      robloxId: profile.robloxId,
      avatarUrl: profile.avatarUrl,
      createdAtIso: profile.createdAtIso,
      updatedAtIso: profile.updatedAtIso,
      versionId: profile.versionId,
    };
  },

  fromDto(dto: PlayerProfileDto): PlayerProfile {
    return PlayerProfile.reconstitute({
      userId: dto.userId,
      gamerTag: dto.gamerTag,
      primaryPlatform: dto.primaryPlatform,
      fortniteId: dto.fortniteId,
      robloxId: dto.robloxId,
      avatarUrl: dto.avatarUrl,
      createdAtIso: dto.createdAtIso,
      updatedAtIso: dto.updatedAtIso,
      versionId: dto.versionId,
    });
  },
};
