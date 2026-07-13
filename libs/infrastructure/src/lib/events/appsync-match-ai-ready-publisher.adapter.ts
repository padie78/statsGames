import type { IMatchAiReadyNotifier, MatchAiReadyEvent } from '@stats-games/application';

const MUTATION_PUBLISH_MATCH_AI_READY = /* GraphQL */ `
  mutation PublishMatchAiReady($input: MatchAiReadyInput!) {
    publishMatchAiReady(input: $input) {
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

export interface AppSyncMatchAiReadyPublisherConfig {
  appsyncEndpoint?: string;
  apiKey?: string;
}

export class AppSyncMatchAiReadyPublisherAdapter implements IMatchAiReadyNotifier {
  private readonly endpoint: string;
  private readonly apiKey?: string;

  constructor(config: AppSyncMatchAiReadyPublisherConfig = {}) {
    this.endpoint = config.appsyncEndpoint ?? process.env['APPSYNC_ENDPOINT'] ?? '';
    this.apiKey = config.apiKey ?? process.env['APPSYNC_API_KEY'];
    if (!this.endpoint || this.endpoint.includes('placeholder')) {
      this.endpoint = '';
    }
  }

  async publishMatchAiReady(event: MatchAiReadyEvent): Promise<void> {
    if (!this.endpoint || !this.apiKey) {
      console.warn(
        JSON.stringify({
          level: 'WARN',
          message: 'AppSync publishMatchAiReady omitido: endpoint/api key ausentes.',
          matchId: event.matchId,
          userId: event.userId,
        }),
      );
      return;
    }

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      body: JSON.stringify({
        query: MUTATION_PUBLISH_MATCH_AI_READY,
        variables: { input: event },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`AppSync publishMatchAiReady falló (${res.status}): ${body.slice(0, 500)}`);
    }

    const json = (await res.json().catch(() => null)) as
      | { errors?: Array<{ message?: string }> }
      | null;

    if (json?.errors?.length) {
      throw new Error(
        `AppSync publishMatchAiReady errors[]: ${json.errors
          .map((e) => e.message)
          .filter(Boolean)
          .join('; ')}`,
      );
    }
  }
}
