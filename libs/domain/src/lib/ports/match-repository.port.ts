import type { Match } from '../entities/match';

export interface IMatchRepository {
  save(match: Match): Promise<void>;
  findByUserAndMatch(userId: string, platform: string, matchId: string): Promise<Match | null>;
}
