import type { IMatchEventNotifier } from '@stats-games/application';
import { MatchMapper } from '@stats-games/application';
import type { Match } from '@stats-games/domain';

const MATCH_UPDATE_FRAGMENT = /* GraphQL */ `
  fragment MatchUpdateFields on MatchUpdate {
    userId
    matchId
    platform
    summary
    updatedAt
    stats {
      kills
      deaths
      placement
      assists
      headshotPct
      roundsWon
      roundsLost
      map
      agent
      mode
      won
    }
  }
`;

const MUTATION_PUBLISH_MATCH_UPDATE = /* GraphQL */ `
  ${MATCH_UPDATE_FRAGMENT}
  mutation PublishMatchUpdate($input: MatchUpdateInput!) {
    publishMatchUpdate(input: $input) {
      ...MatchUpdateFields
    }
  }
`;

export interface AppSyncMatchPublisherConfig {
  appsyncEndpoint?: string;
  apiKey?: string;
}

export class AppSyncMatchUpdatePublisherAdapter implements IMatchEventNotifier {
  private readonly endpoint: string;
  private readonly apiKey?: string;

  constructor(config: AppSyncMatchPublisherConfig = {}) {
    this.endpoint = config.appsyncEndpoint ?? process.env['APPSYNC_ENDPOINT'] ?? '';
    this.apiKey = config.apiKey ?? process.env['APPSYNC_API_KEY'];

    if (!this.endpoint || this.endpoint.includes('placeholder')) {
      this.endpoint = '';
    }
  }

  async publishMatchUpdate(match: Match): Promise<void> {
    if (!this.endpoint || !this.apiKey) {
      console.warn(
        JSON.stringify({
          level: 'WARN',
          message:
            'AppSync publish omitido: APPSYNC_ENDPOINT / APPSYNC_API_KEY no configurados (placeholders). La partida se guardó pero no hay realtime.',
          matchId: match.matchId,
          userId: match.userId,
        }),
      );
      return;
    }

    const dto = MatchMapper.toUpdateDto(match);

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      body: JSON.stringify({
        query: MUTATION_PUBLISH_MATCH_UPDATE,
        variables: {
          input: {
            userId: dto.userId,
            matchId: dto.matchId,
            platform: dto.platform,
            summary: dto.summary,
            updatedAt: dto.updatedAt,
            stats: dto.stats ?? null,
          },
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`AppSync publish falló (${res.status}): ${body.slice(0, 500)}`);
    }

    const json = (await res.json().catch(() => null)) as
      | { errors?: Array<{ message?: string }> }
      | null;

    if (json?.errors?.length) {
      throw new Error(
        `AppSync publish con errors[]: ${json.errors
          .map((e) => e.message)
          .filter(Boolean)
          .join('; ')}`,
      );
    }
  }
}
