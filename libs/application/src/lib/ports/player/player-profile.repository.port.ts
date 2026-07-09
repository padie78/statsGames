import type { PlayerProfile } from '@stats-games/domain';

export interface IPlayerProfileRepository {
  findByUserId(userId: string): Promise<PlayerProfile | null>;
  findByGamerTag(gamerTag: string): Promise<PlayerProfile | null>;
  searchByGamerTagPrefix(query: string, limit?: number): Promise<PlayerProfile[]>;
  save(profile: PlayerProfile): Promise<void>;
}
