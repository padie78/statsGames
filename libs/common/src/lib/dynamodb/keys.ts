/**
 * Single-Table Design — StatsGames (perfiles unificados + partidas).
 *
 * Patrones de acceso:
 *   1. Perfil gamer:     PK = USER#<userId>   SK = PROFILE
 *   2. Partida:          PK = USER#<userId>   SK = MATCH#<platform>#<matchId>
 *   3. Por plataforma:   GSI1PK = PLATFORM#<platform>
 *                        GSI1SK = <playedAtIso>#<matchId>#<userId>
 *   4. Cuenta externa:   PK = PLATFORM_ACCOUNT#<platform>#<externalId>
 *                        SK = LINK  → userId (Cognito sub)
 */

export const KeyPrefix = {
  User: 'USER#',
  Match: 'MATCH#',
  Platform: 'PLATFORM#',
  PlatformAccount: 'PLATFORM_ACCOUNT#',
  GamerTag: 'GAMERTAG#',
  GamerTagIndex: 'GAMERTAG',
  Profile: 'PROFILE',
  Link: 'LINK',
} as const;

/** Normaliza gamerTag para índices y lookups (case-insensitive). */
export function normalizeGamerTag(gamerTag: string): string {
  return gamerTag.trim().toLowerCase();
}

export type GamePlatform = 'fortnite' | 'roblox';

export const DynamoKeys = {
  userPk(userId: string): string {
    return `${KeyPrefix.User}${userId}`;
  },

  profileSk(): string {
    return KeyPrefix.Profile;
  },

  matchSk(platform: GamePlatform, matchId: string): string {
    return `${KeyPrefix.Match}${platform}#${matchId}`;
  },

  platformGsi1Pk(platform: GamePlatform): string {
    return `${KeyPrefix.Platform}${platform}`;
  },

  platformGsi1Sk(playedAtIso: string, matchId: string, userId: string): string {
    return `${playedAtIso}#${matchId}#${userId}`;
  },

  platformAccountPk(platform: GamePlatform, externalId: string): string {
    return `${KeyPrefix.PlatformAccount}${platform}#${externalId}`;
  },

  platformAccountSk(): string {
    return KeyPrefix.Link;
  },

  gamerTagPk(normalizedTag: string): string {
    return `${KeyPrefix.GamerTag}${normalizedTag}`;
  },

  gamerTagGsi2Pk(): string {
    return KeyPrefix.GamerTagIndex;
  },

  gamerTagGsi2Sk(normalizedTag: string, userId: string): string {
    return `${normalizedTag}#${userId}`;
  },
};
