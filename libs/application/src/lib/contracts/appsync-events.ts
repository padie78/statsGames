import type { MatchUpdateDto } from '../dto/event-network/match-update.dto';
import type { PlayerProfileDto } from '../dto/player/player-profile.dto';

export interface OnMatchUpdateEvent {
  userId: string;
  matchId: string;
  update: MatchUpdateDto;
}

export interface OnPlayerProfileUpdatedEvent {
  userId: string;
  profile: PlayerProfileDto;
}

export const AppSyncOperationNames = {
  HealthQuery: 'health',
  PublishMatchUpdateMutation: 'publishMatchUpdate',
  OnMatchUpdateSubscription: 'onMatchUpdate',
  GetPlayerProfileQuery: 'getPlayerProfile',
} as const;
