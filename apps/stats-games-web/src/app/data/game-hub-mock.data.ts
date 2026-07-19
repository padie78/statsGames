import type { SelectedGame } from '../core/game/selected-game';
import { isRobloxExperienceGame } from '../core/game/selected-game';
import { communityScore, mockLeaderboardForPlatform } from './community-mock.data';

export interface GameHubHighlight {
  rank: number;
  gamerTag: string;
  metricLabel: string;
  metricValue: string;
  region: string;
}

export interface GameHubMetaEntity {
  id: string;
  name: string;
  role: string;
  winRate: number;
  pickRate: number;
  imageUrl?: string;
}

export interface GameHubMetaView {
  title: string;
  description: string;
  entities: GameHubMetaEntity[];
}

function lolChampionIcon(name: string): string {
  const key = name.replace(/\s+/g, '').replace(/'/g, '');
  return `https://ddragon.leagueoflegends.com/cdn/14.12.1/img/champion/${key}.png`;
}

const META_BY_PLATFORM: Partial<Record<SelectedGame, GameHubMetaView>> = {
  league_of_legends: {
    title: 'Insights',
    description:
      'Eficiencia global de campeones (últimos 7 días): win rate y pick rate.',
    entities: [
      { id: 'rammus', name: 'Rammus', role: 'Jungle', winRate: 54.2, pickRate: 8.1, imageUrl: lolChampionIcon('Rammus') },
      { id: 'nasus', name: 'Nasus', role: 'Top', winRate: 52.8, pickRate: 6.4, imageUrl: lolChampionIcon('Nasus') },
      { id: 'shyvana', name: 'Shyvana', role: 'Jungle', winRate: 52.1, pickRate: 5.9, imageUrl: lolChampionIcon('Shyvana') },
      { id: 'briar', name: 'Briar', role: 'Jungle', winRate: 51.6, pickRate: 7.2, imageUrl: lolChampionIcon('Briar') },
      { id: 'jinx', name: 'Jinx', role: 'Bottom', winRate: 50.9, pickRate: 12.4, imageUrl: lolChampionIcon('Jinx') },
      { id: 'ahri', name: 'Ahri', role: 'Middle', winRate: 50.4, pickRate: 9.8, imageUrl: lolChampionIcon('Ahri') },
    ],
  },
  valorant: {
    title: 'Agent meta',
    description: 'Agentes con mejor win rate en ranked esta semana.',
    entities: [
      { id: 'jett', name: 'Jett', role: 'Duelist', winRate: 51.8, pickRate: 14.2 },
      { id: 'sage', name: 'Sage', role: 'Sentinel', winRate: 52.4, pickRate: 11.6 },
      { id: 'sova', name: 'Sova', role: 'Initiator', winRate: 51.1, pickRate: 9.4 },
      { id: 'omen', name: 'Omen', role: 'Controller', winRate: 50.7, pickRate: 10.1 },
      { id: 'reyna', name: 'Reyna', role: 'Duelist', winRate: 50.2, pickRate: 12.8 },
      { id: 'cypher', name: 'Cypher', role: 'Sentinel', winRate: 51.5, pickRate: 7.3 },
    ],
  },
  cs2: {
    title: 'Map pool',
    description: 'Mapas con más actividad competitiva esta semana.',
    entities: [
      { id: 'mirage', name: 'Mirage', role: 'Active Duty', winRate: 50.1, pickRate: 18.4 },
      { id: 'inferno', name: 'Inferno', role: 'Active Duty', winRate: 49.8, pickRate: 16.2 },
      { id: 'nuke', name: 'Nuke', role: 'Active Duty', winRate: 50.6, pickRate: 14.1 },
      { id: 'ancient', name: 'Ancient', role: 'Active Duty', winRate: 49.4, pickRate: 12.7 },
      { id: 'anubis', name: 'Anubis', role: 'Active Duty', winRate: 50.2, pickRate: 11.5 },
      { id: 'dust2', name: 'Dust II', role: 'Active Duty', winRate: 49.9, pickRate: 10.8 },
    ],
  },
  rocket_league: {
    title: 'Playlist pulse',
    description: 'Playlists con más partidas tracked esta semana.',
    entities: [
      { id: '2s', name: 'Ranked 2v2', role: 'Competitive', winRate: 50.0, pickRate: 42.1 },
      { id: '3s', name: 'Ranked 3v3', role: 'Competitive', winRate: 50.0, pickRate: 28.4 },
      { id: '1s', name: 'Ranked 1v1', role: 'Competitive', winRate: 50.0, pickRate: 11.2 },
      { id: 'hoops', name: 'Hoops', role: 'Extra Modes', winRate: 50.0, pickRate: 6.8 },
      { id: 'rumble', name: 'Rumble', role: 'Extra Modes', winRate: 50.0, pickRate: 5.4 },
      { id: 'dropshot', name: 'Dropshot', role: 'Extra Modes', winRate: 50.0, pickRate: 3.1 },
    ],
  },
  fortnite: {
    title: 'Mode insights',
    description: 'Modos con más actividad ranked esta semana.',
    entities: [
      { id: 'br', name: 'Battle Royale', role: 'Ranked', winRate: 8.2, pickRate: 38.5 },
      { id: 'zb', name: 'Zero Build', role: 'Ranked', winRate: 9.1, pickRate: 31.2 },
      { id: 'reload', name: 'Reload', role: 'Ranked', winRate: 12.4, pickRate: 14.6 },
      { id: 'og', name: 'OG', role: 'Limited', winRate: 7.8, pickRate: 8.4 },
      { id: 'ballistic', name: 'Ballistic', role: 'Limited', winRate: 48.2, pickRate: 4.2 },
      { id: 'festival', name: 'Festival', role: 'Social', winRate: 0, pickRate: 3.1 },
    ],
  },
  dota2: {
    title: 'Hero meta',
    description: 'Héroes con mejor win rate en ranked esta semana.',
    entities: [
      { id: 'axe', name: 'Axe', role: 'Offlane', winRate: 53.4, pickRate: 9.2 },
      { id: 'invoker', name: 'Invoker', role: 'Mid', winRate: 51.8, pickRate: 11.4 },
      { id: 'pudge', name: 'Pudge', role: 'Support', winRate: 50.6, pickRate: 14.1 },
      { id: 'anti-mage', name: 'Anti-Mage', role: 'Carry', winRate: 51.2, pickRate: 8.7 },
      { id: 'crystal', name: 'Crystal Maiden', role: 'Support', winRate: 52.1, pickRate: 7.9 },
      { id: 'sniper', name: 'Sniper', role: 'Carry', winRate: 50.4, pickRate: 10.3 },
    ],
  },
  overwatch2: {
    title: 'Hero pulse',
    description: 'Héroes con más picks en competitive esta semana.',
    entities: [
      { id: 'ana', name: 'Ana', role: 'Support', winRate: 51.6, pickRate: 12.4 },
      { id: 'winston', name: 'Winston', role: 'Tank', winRate: 50.8, pickRate: 9.1 },
      { id: 'tracer', name: 'Tracer', role: 'Damage', winRate: 50.2, pickRate: 11.8 },
      { id: 'kiriko', name: 'Kiriko', role: 'Support', winRate: 51.1, pickRate: 13.2 },
      { id: 'orisa', name: 'Orisa', role: 'Tank', winRate: 49.7, pickRate: 8.4 },
      { id: 'sojourn', name: 'Sojourn', role: 'Damage', winRate: 50.5, pickRate: 10.6 },
    ],
  },
  clash_royale: {
    title: 'Arena pulse',
    description: 'Arquetipos de deck con más actividad en ladder.',
    entities: [
      { id: 'hog', name: 'Hog Cycle', role: 'Beatdown', winRate: 52.4, pickRate: 14.2 },
      { id: 'logbait', name: 'Log Bait', role: 'Control', winRate: 51.8, pickRate: 11.6 },
      { id: 'golem', name: 'Golem Beatdown', role: 'Beatdown', winRate: 50.6, pickRate: 8.4 },
      { id: 'bridge', name: 'Bridge Spam', role: 'Pressure', winRate: 51.1, pickRate: 9.7 },
      { id: 'lava', name: 'Lava Hound', role: 'Air', winRate: 50.2, pickRate: 7.3 },
      { id: 'xbow', name: 'X-Bow', role: 'Siege', winRate: 49.8, pickRate: 6.1 },
    ],
  },
  brawl_stars: {
    title: 'Mode insights',
    description: 'Modos con más partidas tracked esta semana.',
    entities: [
      { id: 'gem', name: 'Gem Grab', role: '3v3', winRate: 50.0, pickRate: 22.4 },
      { id: 'showdown', name: 'Showdown', role: 'Solo/Duo', winRate: 12.5, pickRate: 18.6 },
      { id: 'brawlball', name: 'Brawl Ball', role: '3v3', winRate: 50.0, pickRate: 16.2 },
      { id: 'heist', name: 'Heist', role: '3v3', winRate: 50.0, pickRate: 11.4 },
      { id: 'bounty', name: 'Bounty', role: '3v3', winRate: 50.0, pickRate: 9.8 },
      { id: 'knockout', name: 'Knockout', role: '3v3', winRate: 50.0, pickRate: 8.1 },
    ],
  },
};

const META_ROBLOX: GameHubMetaView = {
  title: 'Pulso de experiencias',
  description: 'Experiencias con más sesiones tracked esta semana.',
  entities: [
    { id: 'seas', name: 'Third Sea', role: 'Progress', winRate: 0, pickRate: 28.4 },
    { id: 'raids', name: 'Raids', role: 'Co-op', winRate: 62.1, pickRate: 18.2 },
    { id: 'pvp', name: 'PvP Islands', role: 'Combat', winRate: 48.5, pickRate: 16.8 },
    { id: 'quests', name: 'Daily Quests', role: 'Progress', winRate: 0, pickRate: 14.1 },
    { id: 'boss', name: 'World Boss', role: 'Event', winRate: 41.2, pickRate: 12.4 },
    { id: 'trade', name: 'Trading Hub', role: 'Social', winRate: 0, pickRate: 10.1 },
  ],
};

const METRIC_LABEL: Partial<Record<SelectedGame, string>> = {
  league_of_legends: 'League Points',
  valorant: 'RR',
  cs2: 'Rating',
  dota2: 'MMR',
  overwatch2: 'SR',
  rocket_league: 'MMR',
  fortnite: 'Rank Score',
  clash_royale: 'Trophies',
  brawl_stars: 'Trophies',
  blox_fruits: 'Score',
  adopt_me: 'Score',
  brookhaven: 'Score',
};

const REGION_BY_INDEX = ['EU West', 'North America', 'EUNE', 'KR', 'Brazil', 'LAS'];

export function gameHubHighlights(platform: SelectedGame): GameHubHighlight[] {
  return mockLeaderboardForPlatform(platform)
    .slice(0, 3)
    .map((entry, index) => ({
      rank: entry.rank,
      gamerTag: entry.gamerTag,
      metricLabel: METRIC_LABEL[platform] ?? 'Score',
      metricValue: entry.score.toLocaleString('en-US'),
      region: REGION_BY_INDEX[index % REGION_BY_INDEX.length],
    }));
}

export function gameHubMeta(platform: SelectedGame): GameHubMetaView {
  if (META_BY_PLATFORM[platform]) {
    return META_BY_PLATFORM[platform]!;
  }
  if (isRobloxExperienceGame(platform)) {
    return META_ROBLOX;
  }
  return {
    title: 'Insights',
    description: 'Actividad global de la plataforma en los últimos 7 días.',
    entities: META_ROBLOX.entities,
  };
}

export function gameHubSearchHint(platform: SelectedGame): string {
  switch (platform) {
    case 'league_of_legends':
    case 'valorant':
      return 'Riot ID, ej. jugador#LAN';
    case 'cs2':
    case 'dota2':
      return 'Search Steam name or ID…';
    case 'overwatch2':
      return 'Search BattleTag, ie. Player#1234';
    case 'rocket_league':
      return 'Search Epic / Steam / PSN…';
    case 'fortnite':
      return 'Search Epic Display Name…';
    case 'clash_royale':
    case 'brawl_stars':
      return 'Search player tag, ie. #ABC123';
    default:
      return 'Search Roblox username…';
  }
}

export function gameHubSubtitle(platform: SelectedGame): string {
  switch (platform) {
    case 'league_of_legends':
      return 'Check detailed League of Legends stats and leaderboards.';
    case 'valorant':
      return 'Track agents, ACS and ranked climb across every act.';
    case 'cs2':
      return 'ADR, HS% and map performance for competitive CS2.';
    case 'dota2':
      return 'KDA, GPM and hero performance across ranked matches.';
    case 'overwatch2':
      return 'Elims, damage and role queue climb in competitive.';
    case 'rocket_league':
      return 'Goals, saves and MMR across every playlist.';
    case 'fortnite':
      return 'Placement, eliminations and ranked progress in real time.';
    case 'clash_royale':
      return 'Trophies, win rate and deck performance on ladder.';
    case 'brawl_stars':
      return 'Trophies, win rate and brawler form across modes.';
    default:
      return 'Progress, badges and sessions across Roblox experiences.';
  }
}

/** Re-export score helper for potential hub card math. */
export { communityScore };
