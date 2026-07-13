import type { UserRole } from '../auth/user-role';

export type AppNavIcon =
  | 'dashboard'
  | 'matches'
  | 'analytics'
  | 'profile'
  | 'talent'
  | 'radar'
  | 'reports'
  | 'team';

export interface AppSubnavItem {
  id: string;
  /** Label corto para el top nav. */
  label: string;
  /** Título formal (páginas / mobile). */
  title: string;
  /** Una línea: para qué sirve. */
  description: string;
  route: string;
  icon: AppNavIcon;
  /** Si false, marca activo también en rutas hijas (ej. /matches/:id). */
  exact?: boolean;
  badge?: string;
  tone?: 'lime' | 'purple' | 'cyan';
}

export interface AppAccountMenuItem {
  id: string;
  label: string;
  route: string;
}

/**
 * Jugador — enfoque: mi rendimiento.
 * Misma IA en todos los juegos; el switcher de juego cambia el dataset.
 */
export const PLAYER_SUBNAV_ITEMS: AppSubnavItem[] = [
  {
    id: 'dashboard',
    label: 'Inicio',
    title: 'Dashboard',
    description: 'Resumen, rango y últimas stats',
    route: '/tabs/dashboard',
    icon: 'dashboard',
    tone: 'lime',
  },
  {
    id: 'matches',
    label: 'Partidas',
    title: 'Historial de Partidas',
    description: 'Recientes + análisis IA por match',
    route: '/tabs/matches',
    icon: 'matches',
    exact: false,
  },
  {
    id: 'analytics',
    label: 'Evolución',
    title: 'Evolución Táctica',
    description: 'Tendencias semanales y KPIs',
    route: '/tabs/analytics',
    icon: 'analytics',
    tone: 'cyan',
  },
  {
    id: 'profile',
    label: 'Perfil',
    title: 'Mi Perfil Público',
    description: 'Cómo te ven los scouts',
    route: '/tabs/profile',
    icon: 'profile',
  },
];

/**
 * Scout — enfoque: búsqueda y gestión.
 * Misma IA en todos los juegos; filtros/métricas se adaptan al título activo.
 */
export const SCOUT_SUBNAV_ITEMS: AppSubnavItem[] = [
  {
    id: 'talent',
    label: 'Talento',
    title: 'Buscador de Talento',
    description: 'Filtros por métricas, rango y forma',
    route: '/tabs/talent',
    icon: 'talent',
    tone: 'lime',
  },
  {
    id: 'radar',
    label: 'Radar',
    title: 'Mi Radar',
    description: 'Favoritos y seguimiento',
    route: '/tabs/radar',
    icon: 'radar',
    tone: 'cyan',
  },
  {
    id: 'reports',
    label: 'Fichas IA',
    title: 'Reportes Generados',
    description: 'Fichas técnicas del mes',
    route: '/tabs/reports',
    icon: 'reports',
    tone: 'purple',
  },
  {
    id: 'team',
    label: 'Equipo',
    title: 'Gestión de Equipo',
    description: 'Comparar roster en paralelo',
    route: '/tabs/team',
    icon: 'team',
  },
];

/** @deprecated Prefer navItemsForRole */
export const APP_SUBNAV_ITEMS = PLAYER_SUBNAV_ITEMS;

export function navItemsForRole(role: UserRole): AppSubnavItem[] {
  return role === 'scout' ? SCOUT_SUBNAV_ITEMS : PLAYER_SUBNAV_ITEMS;
}

/** Enfoque del portal — va en el chrome junto al juego activo. */
export function navFocusForRole(role: UserRole): string {
  return role === 'scout' ? 'Captación' : 'Mi rendimiento';
}

export const APP_ACCOUNT_MENU_ITEMS: AppAccountMenuItem[] = [
  { id: 'settings', label: 'Configuración', route: '/tabs/settings' },
  { id: 'integrations', label: 'Integraciones', route: '/tabs/integrations' },
];

export const APP_ROUTE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
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
