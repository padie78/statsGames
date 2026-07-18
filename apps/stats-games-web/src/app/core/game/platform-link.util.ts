import { isRobloxExperienceGame, type SelectedGame } from './selected-game';

/** IDs de plataforma en el perfil del jugador. */
export interface PlayerPlatformIds {
  valorantId?: string | null;
  leagueOfLegendsId?: string | null;
  cs2Id?: string | null;
  dota2Id?: string | null;
  overwatch2Id?: string | null;
  rocketLeagueId?: string | null;
  fortniteId?: string | null;
  clashRoyaleId?: string | null;
  brawlStarsId?: string | null;
  robloxId?: string | null;
}

/** True si el juego activo tiene cuenta vinculada en el perfil (no confundir con rollup vacío). */
export function isGameAccountConnected(
  game: SelectedGame,
  ids: PlayerPlatformIds | null | undefined,
): boolean {
  if (!ids) return false;
  if (game === 'valorant') return !!ids.valorantId;
  if (game === 'league_of_legends') return !!ids.leagueOfLegendsId;
  if (game === 'cs2') return !!ids.cs2Id;
  if (game === 'dota2') return !!ids.dota2Id;
  if (game === 'overwatch2') return !!ids.overwatch2Id;
  if (game === 'rocket_league') return !!ids.rocketLeagueId;
  if (game === 'fortnite') return !!ids.fortniteId;
  if (game === 'clash_royale') return !!ids.clashRoyaleId;
  if (game === 'brawl_stars') return !!ids.brawlStarsId;
  if (isRobloxExperienceGame(game)) return !!ids.robloxId;
  return false;
}
