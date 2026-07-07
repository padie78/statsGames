import { Injectable, inject } from '@angular/core';
import { generateClient } from 'aws-amplify/api';
import { Observable, from, map } from 'rxjs';
import { authenticatedAppsyncOptions } from '../core/auth/appsync-auth.util';

export interface MatchUpdateView {
  userId: string;
  matchId: string;
  platform: string;
  summary: string;
  updatedAt: string;
}

interface ListPlayerMatchesResp {
  listPlayerMatches: MatchUpdateView[];
}

const LIST_PLAYER_MATCHES = /* GraphQL */ `
  query ListPlayerMatches($userId: ID!, $limit: Int) {
    listPlayerMatches(userId: $userId, limit: $limit) {
      userId
      matchId
      platform
      summary
      updatedAt
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
    }
  }
`;

@Injectable({ providedIn: 'root' })
export class MatchService {
  private readonly client = generateClient();

  listPlayerMatches(userId: string, limit = 20): Observable<MatchUpdateView[]> {
    return from(
      this.client.graphql({
        query: LIST_PLAYER_MATCHES,
        variables: { userId, limit },
      }),
    ).pipe(map((resp) => (resp as { data: ListPlayerMatchesResp }).data.listPlayerMatches));
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
