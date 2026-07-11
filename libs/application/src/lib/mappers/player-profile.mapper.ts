import { PlayerProfile } from '@stats-games/domain';
import type { PlayerProfileDto } from '../dto/player/player-profile.dto';
import type {
  PlayerSearchHitDto,
  PublicPlayerProfileDto,
} from '../dto/player/public-player-profile.dto';

export const PlayerProfileMapper = {
  toDto(profile: PlayerProfile): PlayerProfileDto {
    return {
      userId: profile.userId,
      gamerTag: profile.gamerTag,
      primaryPlatform: profile.primaryPlatform,
      fortniteId: profile.fortniteId,
      robloxId: profile.robloxId,
      valorantId: profile.valorantId,
      rocketLeagueId: profile.rocketLeagueId,
      avatarUrl: profile.avatarUrl,
      createdAtIso: profile.createdAtIso,
      updatedAtIso: profile.updatedAtIso,
      versionId: profile.versionId,
    };
  },

  toPublicDto(profile: PlayerProfile): PublicPlayerProfileDto {
    return {
      userId: profile.userId,
      gamerTag: profile.gamerTag,
      primaryPlatform: profile.primaryPlatform,
      avatarUrl: profile.avatarUrl,
      createdAtIso: profile.createdAtIso,
    };
  },

  toSearchHit(profile: PlayerProfile): PlayerSearchHitDto {
    return {
      userId: profile.userId,
      gamerTag: profile.gamerTag,
      primaryPlatform: profile.primaryPlatform,
      avatarUrl: profile.avatarUrl,
    };
  },

  fromDto(dto: PlayerProfileDto): PlayerProfile {
    return PlayerProfile.reconstitute({
      userId: dto.userId,
      gamerTag: dto.gamerTag,
      primaryPlatform: dto.primaryPlatform,
      fortniteId: dto.fortniteId,
      robloxId: dto.robloxId,
      valorantId: dto.valorantId,
      rocketLeagueId: dto.rocketLeagueId,
      avatarUrl: dto.avatarUrl,
      createdAtIso: dto.createdAtIso,
      updatedAtIso: dto.updatedAtIso,
      versionId: dto.versionId,
    });
  },
};
