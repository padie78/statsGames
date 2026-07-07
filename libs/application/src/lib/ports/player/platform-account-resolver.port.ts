import type { GamePlatform } from '@stats-games/common';

export interface IPlatformAccountResolver {
  findUserIdByPlatformAccount(
    platform: GamePlatform,
    externalId: string,
  ): Promise<string | null>;
}
