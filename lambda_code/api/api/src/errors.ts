import { ZodError } from 'zod';
import type { StatsGranularity } from '@stats-games/common';
import { PlayerNotFoundError } from '@stats-games/domain';

export type AppSyncErrorType = 'PlayerNotFound' | 'ValidationError' | 'Forbidden';

export class AppSyncTypedError extends Error {
  constructor(
    public readonly errorType: AppSyncErrorType,
    message: string,
  ) {
    super(message);
    this.name = 'AppSyncTypedError';
  }
}

export function rethrowAsTyped(err: unknown): never {
  if (err instanceof PlayerNotFoundError) {
    const typed = new AppSyncTypedError('PlayerNotFound', err.message);
    typed.name = 'PlayerNotFound';
    throw typed;
  }
  if (err instanceof ZodError) {
    const typed = new AppSyncTypedError('ValidationError', err.message);
    typed.name = 'ValidationError';
    throw typed;
  }
  throw err;
}

export function asStatsGranularity(value: string): StatsGranularity {
  const normalized = value.toUpperCase();
  if (normalized === 'DAILY' || normalized === 'WEEKLY' || normalized === 'MONTHLY') {
    return normalized;
  }
  throw new AppSyncTypedError('ValidationError', `granularity inválida: ${value}`);
}

export function asPlatform(
  value?: string | null,
):
  | 'fortnite'
  | 'roblox'
  | 'valorant'
  | 'league_of_legends'
  | 'cs2'
  | 'rocket_league'
  | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (
    normalized === 'fortnite' ||
    normalized === 'roblox' ||
    normalized === 'valorant' ||
    normalized === 'league_of_legends' ||
    normalized === 'cs2' ||
    normalized === 'rocket_league'
  ) {
    return normalized;
  }
  throw new AppSyncTypedError('ValidationError', `platform inválida: ${value}`);
}
