import type { UserRole } from '../auth/user-role';

export interface AppSubnavItem {
  id: string;
  label: string;
  route: string;
  badge?: string;
  tone?: 'lime' | 'purple' | 'cyan';
}

export interface AppAccountMenuItem {
  id: string;
  label: string;
  route: string;
}

/** Nav Jugador — Mi Rendimiento */
export const PLAYER_SUBNAV_ITEMS: AppSubnavItem[] = [
  { id: 'dashboard', label: 'Inicio', route: '/tabs/dashboard', tone: 'lime' },
  { id: 'matches', label: 'Historial', route: '/tabs/matches' },
  { id: 'analytics', label: 'Evolución', route: '/tabs/analytics', tone: 'cyan' },
  { id: 'profile', label: 'Mi Perfil', route: '/tabs/profile' },
];

/** Nav Scout — Búsqueda y Gestión */
export const SCOUT_SUBNAV_ITEMS: AppSubnavItem[] = [
  { id: 'talent', label: 'Buscador', route: '/tabs/talent', tone: 'lime' },
  { id: 'radar', label: 'Mi Radar', route: '/tabs/radar', tone: 'cyan' },
  { id: 'reports', label: 'Reportes', route: '/tabs/reports', tone: 'purple' },
  { id: 'team', label: 'Equipo', route: '/tabs/team' },
];

/** @deprecated Prefer navItemsForRole */
export const APP_SUBNAV_ITEMS = PLAYER_SUBNAV_ITEMS;

export function navItemsForRole(role: UserRole): AppSubnavItem[] {
  return role === 'scout' ? SCOUT_SUBNAV_ITEMS : PLAYER_SUBNAV_ITEMS;
}

export const APP_ACCOUNT_MENU_ITEMS: AppAccountMenuItem[] = [
  { id: 'settings', label: 'Configuración', route: '/tabs/settings' },
  { id: 'integrations', label: 'Integraciones', route: '/tabs/integrations' },
];

export const APP_ROUTE_TITLES: Record<string, string> = {
  dashboard: 'Inicio',
  matches: 'Historial de Partidas',
  analytics: 'Evolución Táctica',
  profile: 'Mi Perfil Público',
  talent: 'Buscador de Talento',
  radar: 'Mi Radar',
  reports: 'Reportes Generados',
  team: 'Gestión de Equipo',
  integrations: 'Integraciones',
  'ai-coach': 'AI Coach',
  settings: 'Configuración',
};
