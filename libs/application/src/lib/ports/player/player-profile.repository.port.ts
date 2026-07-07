import type { PlayerProfile } from '@stats-games/domain';

export interface IPlayerProfileRepository {
  findByUserId(userId: string): Promise<PlayerProfile | null>;
  save(profile: PlayerProfile): Promise<void>;
}
