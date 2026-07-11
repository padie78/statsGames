import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/api';
import { Observable, firstValueFrom, from, map } from 'rxjs';
import { authenticatedAppsyncOptions } from '../core/auth/appsync-auth.util';
import type { BackendPlatform } from '../core/game/selected-game';

export interface MatchStatsView {
  kills?: number | null;
  deaths?: number | null;
  placement?: number | null;
  assists?: number | null;
}

export interface MatchUpdateView {
  userId: string;
  matchId: string;
  platform: string;
  summary: string;
  updatedAt: string;
  stats?: MatchStatsView | null;
}

interface ListPlayerMatchesResp {
  listPlayerMatches: MatchUpdateView[];
}

const MATCH_STATS_FIELDS = /* GraphQL */ `
  stats {
    kills
    deaths
    placement
    assists
  }
`;

const LIST_PLAYER_MATCHES = /* GraphQL */ `
  query ListPlayerMatches($userId: ID!, $platform: String, $limit: Int) {
    listPlayerMatches(userId: $userId, platform: $platform, limit: $limit) {
      userId
      matchId
      platform
      summary
      updatedAt
      ${MATCH_STATS_FIELDS}
    }
  }
`;

const ON_MATCH_UPDATE = /* GraphQL */ `
  subscription OnMatchUpdate($userId: ID!) {
    onMatchUpdate(userId: $userId) {
      userId
      matchId
      platform
      summary
      updatedAt
      ${MATCH_STATS_FIELDS}
    }
  }
`;

@Injectable({ providedIn: 'root' })
export class MatchService {
  private readonly client = generateClient();

  listPlayerMatches(
    userId: string,
    options?: { platform?: BackendPlatform; limit?: number },
  ): Observable<MatchUpdateView[]> {
    return from(
      this.client.graphql({
        query: LIST_PLAYER_MATCHES,
        variables: {
          userId,
          platform: options?.platform,
          limit: options?.limit ?? 50,
        },
      }),
    ).pipe(map((resp) => (resp as { data: ListPlayerMatchesResp }).data.listPlayerMatches));
  }

  async listPlayerMatchesOnce(
    userId: string,
    options?: { platform?: BackendPlatform; limit?: number },
  ): Promise<MatchUpdateView[]> {
    return firstValueFrom(this.listPlayerMatches(userId, options));
  }

  onMatchUpdate(userId: string): Observable<MatchUpdateView> {
    return new Observable<MatchUpdateView>((subscriber) => {
      let handle: { unsubscribe: () => void } | undefined;

      void authenticatedAppsyncOptions()
        .then((authOptions) => {
          const subscriptionObservable = this.client.graphql({
            query: ON_MATCH_UPDATE,
            variables: { userId },
            ...authOptions,
          });

          handle = (
            subscriptionObservable as unknown as {
              subscribe: (handlers: {
                next: (msg: { data?: { onMatchUpdate?: MatchUpdateView } }) => void;
                error: (e: unknown) => void;
                complete?: () => void;
              }) => { unsubscribe: () => void };
            }
          ).subscribe({
            next: (msg) => {
              const payload = msg.data?.onMatchUpdate;
              if (payload) subscriber.next(payload);
            },
            error: (err) => subscriber.error(err),
            complete: () => subscriber.complete(),
          });
        })
        .catch((err) => subscriber.error(err));

      return () => handle?.unsubscribe();
    });
  }
}
