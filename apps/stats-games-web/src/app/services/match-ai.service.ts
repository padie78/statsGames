import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/api';
import { Observable, firstValueFrom, from, map } from 'rxjs';
import { authenticatedAppsyncOptions } from '../core/auth/appsync-auth.util';
import type { BackendPlatform } from '../core/game/selected-game';

export interface MatchAiReportView {
  userId: string;
  matchId: string;
  platform: string;
  headline: string;
  summary: string;
  markdown: string;
  performanceScore: number;
  gradeLabel: string;
  verdict: string;
  pros: string[];
  cons: string[];
  actionPlan: string[];
  status: string;
  createdAt: string;
}

export interface MatchAiReadyView {
  userId: string;
  matchId: string;
  platform: string;
  headline: string;
  summary: string;
  performanceScore?: number | null;
  gradeLabel?: string | null;
  verdict?: string | null;
  status: string;
  createdAt: string;
}

const GET_MATCH_AI_REPORT = /* GraphQL */ `
  query GetMatchAiReport($userId: ID!, $matchId: ID!) {
    getMatchAiReport(userId: $userId, matchId: $matchId) {
      userId
      matchId
      platform
      headline
      summary
      markdown
      performanceScore
      gradeLabel
      verdict
      pros
      cons
      actionPlan
      status
      createdAt
    }
  }
`;

const LIST_MATCH_AI_REPORTS = /* GraphQL */ `
  query ListMatchAiReports($userId: ID!, $platform: String, $limit: Int) {
    listMatchAiReports(userId: $userId, platform: $platform, limit: $limit) {
      userId
      matchId
      platform
      headline
      summary
      markdown
      performanceScore
      gradeLabel
      verdict
      pros
      cons
      actionPlan
      status
      createdAt
    }
  }
`;

const ON_MATCH_AI_READY = /* GraphQL */ `
  subscription OnMatchAiReady($userId: ID!) {
    onMatchAiReady(userId: $userId) {
      userId
      matchId
      platform
      headline
      summary
      performanceScore
      gradeLabel
      verdict
      status
      createdAt
    }
  }
`;

@Injectable({ providedIn: 'root' })
export class MatchAiService {
  private readonly client = generateClient();

  async getMatchAiReport(userId: string, matchId: string): Promise<MatchAiReportView | null> {
    const resp = await this.client.graphql({
      query: GET_MATCH_AI_REPORT,
      variables: { userId, matchId },
    });
    return (resp as { data: { getMatchAiReport: MatchAiReportView | null } }).data
      .getMatchAiReport;
  }

  listMatchAiReports(
    userId: string,
    options?: { platform?: BackendPlatform; limit?: number },
  ): Observable<MatchAiReportView[]> {
    return from(
      this.client.graphql({
        query: LIST_MATCH_AI_REPORTS,
        variables: {
          userId,
          platform: options?.platform,
          limit: options?.limit ?? 20,
        },
      }),
    ).pipe(
      map(
        (resp) =>
          (resp as { data: { listMatchAiReports: MatchAiReportView[] } }).data.listMatchAiReports,
      ),
    );
  }

  async listMatchAiReportsOnce(
    userId: string,
    options?: { platform?: BackendPlatform; limit?: number },
  ): Promise<MatchAiReportView[]> {
    return firstValueFrom(this.listMatchAiReports(userId, options));
  }

  onMatchAiReady(userId: string): Observable<MatchAiReadyView> {
    return new Observable<MatchAiReadyView>((subscriber) => {
      let handle: { unsubscribe: () => void } | undefined;

      void authenticatedAppsyncOptions()
        .then((authOptions) => {
          const subscriptionObservable = this.client.graphql({
            query: ON_MATCH_AI_READY,
            variables: { userId },
            ...authOptions,
          });

          handle = (
            subscriptionObservable as unknown as {
              subscribe: (handlers: {
                next: (msg: { data?: { onMatchAiReady?: MatchAiReadyView } }) => void;
                error: (e: unknown) => void;
                complete?: () => void;
              }) => { unsubscribe: () => void };
            }
          ).subscribe({
            next: (msg) => {
              const payload = msg.data?.onMatchAiReady;
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
