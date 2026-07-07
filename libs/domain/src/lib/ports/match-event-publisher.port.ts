import type { Match } from '../entities/match';

export interface IMatchEventPublisher {
  publishMatchUpdate(match: Match): Promise<void>;
}
