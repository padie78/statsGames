export type UserRole = 'player' | 'scout';

export const USER_ROLES: readonly UserRole[] = ['player', 'scout'] as const;

export function normalizeUserRole(raw: unknown): UserRole {
  if (typeof raw !== 'string') return 'player';
  const value = raw.trim().toLowerCase();
  if (value === 'scout' || value === 'recruiter') return 'scout';
  return 'player';
}

export function defaultHomeRouteForRole(role: UserRole): string {
  return role === 'scout' ? '/tabs/talent' : '/tabs/dashboard';
}

export function roleLabel(role: UserRole): string {
  return role === 'scout' ? 'Scout' : 'Jugador';
}
