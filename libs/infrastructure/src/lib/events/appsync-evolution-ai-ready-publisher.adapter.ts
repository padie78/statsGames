import type {
  EvolutionAiReadyEvent,
  IEvolutionAiReadyNotifier,
} from '@stats-games/application';

const MUTATION_PUBLISH_EVOLUTION_AI_READY = /* GraphQL */ `
  mutation PublishEvolutionAiReady($input: EvolutionAiReadyInput!) {
    publishEvolutionAiReady(input: $input) {
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

export class AppSyncEvolutionAiReadyPublisherAdapter implements IEvolutionAiReadyNotifier {
  private readonly endpoint: string;
  private readonly apiKey?: string;

  constructor(
    config: { appsyncEndpoint?: string; apiKey?: string } = {},
  ) {
    this.endpoint = config.appsyncEndpoint ?? process.env['APPSYNC_ENDPOINT'] ?? '';
    this.apiKey = config.apiKey ?? process.env['APPSYNC_API_KEY'];
    if (!this.endpoint || this.endpoint.includes('placeholder')) {
      this.endpoint = '';
    }
  }

  async publishEvolutionAiReady(event: EvolutionAiReadyEvent): Promise<void> {
    if (!this.endpoint || !this.apiKey) {
      console.warn(
        JSON.stringify({
          level: 'WARN',
          message: 'AppSync publishEvolutionAiReady omitido: endpoint/api key ausentes.',
          periodId: event.periodId,
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
        query: MUTATION_PUBLISH_EVOLUTION_AI_READY,
        variables: { input: event },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `AppSync publishEvolutionAiReady falló (${res.status}): ${body.slice(0, 500)}`,
      );
    }

    const json = (await res.json().catch(() => null)) as
      | { errors?: Array<{ message?: string }> }
      | null;

    if (json?.errors?.length) {
      throw new Error(
        `AppSync publishEvolutionAiReady errors[]: ${json.errors
          .map((e) => e.message)
          .filter(Boolean)
          .join('; ')}`,
      );
    }
  }
}
