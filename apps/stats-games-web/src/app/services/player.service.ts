import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/api';
import { Observable, firstValueFrom, from, map } from 'rxjs';
import { authenticatedAppsyncOptions } from '../core/auth/appsync-auth.util';

export interface PlayerProfileView {
  userId: string;
  gamerTag: string;
  primaryPlatform: string;
  fortniteId?: string | null;
  robloxId?: string | null;
  avatarUrl?: string | null;
}

export interface UpsertPlayerProfileInput {
  userId: string;
  gamerTag: string;
  primaryPlatform: 'fortnite' | 'roblox';
  fortniteId?: string;
  robloxId?: string;
}

export interface LinkPlatformAccountInput {
  userId: string;
  platform: 'fortnite' | 'roblox';
  externalId: string;
}

interface GetPlayerProfileResp {
  getPlayerProfile: PlayerProfileView;
}

interface UpsertPlayerProfileResp {
  upsertPlayerProfile: PlayerProfileView;
}

interface LinkPlatformAccountResp {
  linkPlatformAccount: PlayerProfileView;
}

const GET_PLAYER_PROFILE = /* GraphQL */ `
  query GetPlayerProfile($userId: ID!) {
    getPlayerProfile(userId: $userId) {
      userId
      gamerTag
      primaryPlatform
      fortniteId
      robloxId
      avatarUrl
    }
  }
`;

const UPSERT_PLAYER_PROFILE = /* GraphQL */ `
  mutation UpsertPlayerProfile($input: UpsertPlayerProfileInput!) {
    upsertPlayerProfile(input: $input) {
      userId
      gamerTag
      primaryPlatform
      fortniteId
      robloxId
      avatarUrl
    }
  }
`;

const LINK_PLATFORM_ACCOUNT = /* GraphQL */ `
  mutation LinkPlatformAccount($input: LinkPlatformAccountInput!) {
    linkPlatformAccount(input: $input) {
      userId
      gamerTag
      primaryPlatform
      fortniteId
      robloxId
      avatarUrl
    }
  }
`;

@Injectable({ providedIn: 'root' })
export class PlayerService {
  private readonly client = generateClient();

  getPlayerProfile(userId: string): Observable<PlayerProfileView> {
    return from(this.authenticatedGraphql<{ data: GetPlayerProfileResp }>({
      query: GET_PLAYER_PROFILE,
      variables: { userId },
    })).pipe(map((resp) => resp.data.getPlayerProfile));
  }

  async getPlayerProfileOrNull(userId: string): Promise<PlayerProfileView | null> {
    try {
      return await firstValueFrom(this.getPlayerProfile(userId));
    } catch (error) {
      if (isPlayerNotFoundError(error)) return null;
      throw error;
    }
  }

  upsertPlayerProfile(input: UpsertPlayerProfileInput): Observable<PlayerProfileView> {
    return from(
      this.authenticatedGraphql<{ data: UpsertPlayerProfileResp }>({
        query: UPSERT_PLAYER_PROFILE,
        variables: { input },
      }),
    ).pipe(map((resp) => resp.data.upsertPlayerProfile));
  }

  linkPlatformAccount(input: LinkPlatformAccountInput): Observable<PlayerProfileView> {
    return from(
      this.authenticatedGraphql<{ data: LinkPlatformAccountResp }>({
        query: LINK_PLATFORM_ACCOUNT,
        variables: { input },
      }),
    ).pipe(map((resp) => resp.data.linkPlatformAccount));
  }

  private async authenticatedGraphql<T>(params: {
    query: string;
    variables?: Record<string, unknown>;
  }): Promise<T> {
    const authOptions = await authenticatedAppsyncOptions();
    const result = await this.client.graphql({
      query: params.query,
      variables: params.variables,
      ...authOptions,
    });
    return result as T;
  }
}

function isPlayerNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const err = error as {
    message?: string;
    errors?: Array<{ message?: string; errorType?: string }>;
  };

  const messages = [
    err.message,
    ...(err.errors?.map((e) => e.message) ?? []),
  ].filter(Boolean);

  const types = err.errors?.map((e) => e.errorType).filter(Boolean) ?? [];

  return (
    types.some((t) => t === 'PlayerNotFound') ||
    messages.some(
      (m) =>
        m?.includes('Perfil de jugador no encontrado') ||
        m?.includes('PlayerNotFound'),
    )
  );
}
