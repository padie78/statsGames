import { InvalidPlatformError } from '../errors/domain-errors';

export type GamePlatform = 'fortnite' | 'roblox';

const PLATFORMS: ReadonlySet<string> = new Set(['fortnite', 'roblox']);

export class Platform {
  private constructor(public readonly value: GamePlatform) {}

  static from(raw: string): Platform {
    const normalized = raw.toLowerCase();
    if (!PLATFORMS.has(normalized)) {
      throw new InvalidPlatformError(raw);
    }
    return new Platform(normalized as GamePlatform);
  }

  toString(): string {
    return this.value;
  }
}
