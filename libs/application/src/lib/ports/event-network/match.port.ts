import type { GamePlatform } from '@stats-games/domain';
import type { Match } from '@stats-games/domain';

export interface IMatchWriter {
  save(match: Match): Promise<void>;
}

export interface IMatchReader {
  listByUser(
    userId: string,
    options?: { platform?: GamePlatform; limit?: number },
  ): Promise<Match[]>;
}

export interface IMatchEventNotifier {
  publishMatchUpdate(match: Match): Promise<void>;
}
