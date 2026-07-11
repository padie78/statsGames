import { InvalidPlatformError } from '../errors/domain-errors';

export type GamePlatform = 'fortnite' | 'roblox' | 'valorant' | 'rocket_league';

const PLATFORMS: ReadonlySet<string> = new Set([
  'fortnite',
  'roblox',
  'valorant',
  'rocket_league',
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
    return ['valorant', 'rocket_league', 'fortnite', 'roblox'];
  }

  toString(): string {
    return this.value;
  }
}
