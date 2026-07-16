import { InvalidPlatformError } from '../errors/domain-errors';

export type GamePlatform =
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

const PLATFORMS: ReadonlySet<string> = new Set([
  'fortnite',
  'roblox',
  'valorant',
  'league_of_legends',
  'cs2',
  'dota2',
  'overwatch2',
  'rocket_league',
  'clash_royale',
  'brawl_stars',
]);

export class Platform {
  private constructor(public readonly value: GamePlatform) {}

  static from(raw: string): Platform {
    const normalized = raw.toLowerCase();
    if (!PLATFORMS.has(normalized)) {
      throw new InvalidPlatformError(raw);
    }
    return new Platform(normalized as GamePlatform);
  }

  static all(): readonly GamePlatform[] {
    return [
      'valorant',
      'league_of_legends',
      'cs2',
      'dota2',
      'overwatch2',
      'rocket_league',
      'fortnite',
      'clash_royale',
      'brawl_stars',
      'roblox',
    ];
  }

  toString(): string {
    return this.value;
  }
}
