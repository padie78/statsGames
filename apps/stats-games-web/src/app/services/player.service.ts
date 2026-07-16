import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/api';
import { Observable, firstValueFrom, from, map } from 'rxjs';
import { authenticatedAppsyncOptions } from '../core/auth/appsync-auth.util';
import { assertGraphqlData } from '../utils/graphql-error.util';

export interface PlayerProfileView {
  userId: string;
  gamerTag: string;
  primaryPlatform: string;
  fortniteId?: string | null;
  robloxId?: string | null;
  valorantId?: string | null;
  leagueOfLegendsId?: string | null;
  cs2Id?: string | null;
  dota2Id?: string | null;
  overwatch2Id?: string | null;
  rocketLeagueId?: string | null;
  clashRoyaleId?: string | null;
  brawlStarsId?: string | null;
  avatarUrl?: string | null;
}

export interface PublicPlayerProfileView {
  userId: string;
  gamerTag: string;
  primaryPlatform: string;
  avatarUrl?: string | null;
  createdAtIso: string;
}

export interface PlayerSearchHitView {
  userId: string;
  gamerTag: string;
  primaryPlatform: string;
  avatarUrl?: string | null;
}

export interface UpsertPlayerProfileInput {
  userId: string;
  gamerTag: string;
  primaryPlatform:
    | 'fortnite'
    | 'roblox'
    | 'valorant'
    | 'league_of_legends'
    | 'cs2'
    | 'dota2'
    | 'overwatch2'
    | 'rocket_league'
    | 'clash_royale'
    | 'brawl_stars';
  fortniteId?: string;
  robloxId?: string;
  valorantId?: string;
  leagueOfLegendsId?: string;
  cs2Id?: string;
  dota2Id?: string;
  overwatch2Id?: string;
  rocketLeagueId?: string;
  clashRoyaleId?: string;
  brawlStarsId?: string;
  avatarUrl?: string;
}

export interface LinkPlatformAccountInput {
  userId: string;
  platform:
    | 'fortnite'
    | 'roblox'
    | 'valorant'
    | 'league_of_legends'
    | 'cs2'
    | 'dota2'
    | 'overwatch2'
    | 'rocket_league'
    | 'clash_royale'
    | 'brawl_stars';
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

interface GetProfileByGamerTagResp {
  getProfileByGamerTag: PublicPlayerProfileView;
}

interface SearchPlayersResp {
  searchPlayers: PlayerSearchHitView[];
}

const PROFILE_FIELDS = /* GraphQL */ `
  userId
  gamerTag
  primaryPlatform
  fortniteId
  robloxId
  valorantId
  leagueOfLegendsId
  cs2Id
  dota2Id
  overwatch2Id
  rocketLeagueId
  clashRoyaleId
  brawlStarsId
  avatarUrl
`;

const GET_PLAYER_PROFILE = /* GraphQL */ `
  query GetPlayerProfile($userId: ID!) {
    getPlayerProfile(userId: $userId) {
      ${PROFILE_FIELDS}
    }
  }
`;

const UPSERT_PLAYER_PROFILE = /* GraphQL */ `
  mutation UpsertPlayerProfile($input: UpsertPlayerProfileInput!) {
    upsertPlayerProfile(input: $input) {
      ${PROFILE_FIELDS}
      createdAtIso
      updatedAtIso
      versionId
    }
  }
`;

const LINK_PLATFORM_ACCOUNT = /* GraphQL */ `
  mutation LinkPlatformAccount($input: LinkPlatformAccountInput!) {
    linkPlatformAccount(input: $input) {
      ${PROFILE_FIELDS}
      createdAtIso
      updatedAtIso
      versionId
    }
  }
`;

const GET_PROFILE_BY_GAMER_TAG = /* GraphQL */ `
  query GetProfileByGamerTag($gamerTag: String!) {
    getProfileByGamerTag(gamerTag: $gamerTag) {
      userId
      gamerTag
      primaryPlatform
      avatarUrl
      createdAtIso
    }
  }
`;

const SEARCH_PLAYERS = /* GraphQL */ `
  query SearchPlayers($query: String!, $limit: Int) {
    searchPlayers(query: $query, limit: $limit) {
      userId
      gamerTag
      primaryPlatform
      avatarUrl
    }
  }
`;

@Injectable({ providedIn: 'root' })
export class PlayerService {
  private readonly client = generateClient();

  getPlayerProfile(userId: string): Observable<PlayerProfileView> {
    return from(
      this.client.graphql({
        query: GET_PLAYER_PROFILE,
        variables: { userId },
      }),
    ).pipe(
      map((resp) =>
        assertGraphqlData<GetPlayerProfileResp>(resp as { data?: GetPlayerProfileResp })
          .getPlayerProfile,
      ),
    );
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
      (async () => {
        const authOptions = await authenticatedAppsyncOptions().catch(() => ({}));
        return this.client.graphql({
          query: UPSERT_PLAYER_PROFILE,
          variables: { input },
          ...authOptions,
        });
      })(),
    ).pipe(
      map((resp) =>
        assertGraphqlData<UpsertPlayerProfileResp>(resp as { data?: UpsertPlayerProfileResp })
          .upsertPlayerProfile,
      ),
    );
  }

  linkPlatformAccount(input: LinkPlatformAccountInput): Observable<PlayerProfileView> {
    return from(
      (async () => {
        const authOptions = await authenticatedAppsyncOptions().catch(() => ({}));
        return this.client.graphql({
          query: LINK_PLATFORM_ACCOUNT,
          variables: { input },
          ...authOptions,
        });
      })(),
    ).pipe(
      map((resp) =>
        assertGraphqlData<LinkPlatformAccountResp>(resp as { data?: LinkPlatformAccountResp })
          .linkPlatformAccount,
      ),
    );
  }

  getProfileByGamerTag(gamerTag: string): Observable<PublicPlayerProfileView> {
    return from(
      this.client.graphql({
        query: GET_PROFILE_BY_GAMER_TAG,
        variables: { gamerTag },
      }),
    ).pipe(
      map((resp) =>
        assertGraphqlData<GetProfileByGamerTagResp>(resp as { data?: GetProfileByGamerTagResp })
          .getProfileByGamerTag,
      ),
    );
  }

  async getProfileByGamerTagOrNull(gamerTag: string): Promise<PublicPlayerProfileView | null> {
    try {
      return await firstValueFrom(this.getProfileByGamerTag(gamerTag));
    } catch (error) {
      if (isPlayerNotFoundError(error)) return null;
      throw error;
    }
  }

  searchPlayers(query: string, limit = 8): Observable<PlayerSearchHitView[]> {
    return from(
      this.client.graphql({
        query: SEARCH_PLAYERS,
        variables: { query, limit },
      }),
    ).pipe(
      map((resp) =>
        assertGraphqlData<SearchPlayersResp>(resp as { data?: SearchPlayersResp }).searchPlayers,
      ),
    );
  }
}

function isPlayerNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const err = error as {
    message?: string;
    errors?: Array<{ message?: string; errorType?: string }>;
  };

  const messages = [err.message, ...(err.errors?.map((e) => e.message) ?? [])].filter(Boolean);

  const types = err.errors?.map((e) => e.errorType).filter(Boolean) ?? [];

  return (
    types.some((t) => t === 'PlayerNotFound') ||
    messages.some(
      (m) => m?.includes('Perfil de jugador no encontrado') || m?.includes('PlayerNotFound'),
    )
  );
}
