import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/api';
import { Observable } from 'rxjs';
import { authenticatedAppsyncOptions } from '../core/auth/appsync-auth.util';
import type { BackendPlatform } from '../core/game/selected-game';

export interface EvolutionAiReportView {
  userId: string;
  platform: string;
  periodId: string;
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

export interface EvolutionAiReadyView {
  userId: string;
  platform: string;
  periodId: string;
  headline: string;
  summary: string;
  performanceScore?: number | null;
  gradeLabel?: string | null;
  verdict?: string | null;
  status: string;
  createdAt: string;
}

const GET_EVOLUTION_AI_REPORT = /* GraphQL */ `
  query GetEvolutionAiReport($userId: ID!, $platform: String!, $periodId: String!) {
    getEvolutionAiReport(userId: $userId, platform: $platform, periodId: $periodId) {
      userId
      platform
      periodId
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

const REQUEST_EVOLUTION_AI_REPORT = /* GraphQL */ `
  mutation RequestEvolutionAiReport($input: RequestEvolutionAiReportInput!) {
    requestEvolutionAiReport(input: $input) {
      userId
      platform
      periodId
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

const ON_EVOLUTION_AI_READY = /* GraphQL */ `
  subscription OnEvolutionAiReady($userId: ID!) {
    onEvolutionAiReady(userId: $userId) {
      userId
      platform
      periodId
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
export class EvolutionAiService {
  private readonly client = generateClient();

  async getEvolutionAiReport(
    userId: string,
    platform: BackendPlatform,
    periodId: string,
  ): Promise<EvolutionAiReportView | null> {
    const resp = await this.client.graphql({
      query: GET_EVOLUTION_AI_REPORT,
      variables: { userId, platform, periodId },
    });
    return (resp as { data: { getEvolutionAiReport: EvolutionAiReportView | null } }).data
      .getEvolutionAiReport;
  }

  async requestEvolutionAiReport(input: {
    userId: string;
    platform: BackendPlatform;
    periodId: string;
    force?: boolean;
  }): Promise<EvolutionAiReportView> {
    const resp = await this.client.graphql({
      query: REQUEST_EVOLUTION_AI_REPORT,
      variables: { input },
    });
    return (resp as { data: { requestEvolutionAiReport: EvolutionAiReportView } }).data
      .requestEvolutionAiReport;
  }

  onEvolutionAiReady(userId: string): Observable<EvolutionAiReadyView> {
    return new Observable<EvolutionAiReadyView>((subscriber) => {
      let handle: { unsubscribe: () => void } | undefined;

      void authenticatedAppsyncOptions()
        .then((authOptions) => {
          const subscriptionObservable = this.client.graphql({
            query: ON_EVOLUTION_AI_READY,
            variables: { userId },
            ...authOptions,
          });

          handle = (
            subscriptionObservable as unknown as {
              subscribe: (handlers: {
                next: (value: unknown) => void;
                error: (err: unknown) => void;
              }) => { unsubscribe: () => void };
            }
          ).subscribe({
            next: (value) => {
              const payload = value as {
                data?: { onEvolutionAiReady?: EvolutionAiReadyView };
              };
              const event = payload.data?.onEvolutionAiReady;
              if (event) subscriber.next(event);
            },
            error: (err) => subscriber.error(err),
          });
        })
        .catch((err) => subscriber.error(err));

      return () => handle?.unsubscribe();
    });
  }
}
