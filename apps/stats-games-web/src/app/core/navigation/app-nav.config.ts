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

/**
 * Línea 3 (game nav) — solo secciones del juego activo.
 * Cuenta (Config / Integraciones / Perfil / Salir) → dropdown del avatar.
 */
export const APP_SUBNAV_ITEMS: AppSubnavItem[] = [
  { id: 'dashboard', label: 'Overview', route: '/tabs/dashboard', tone: 'lime' },
  { id: 'matches', label: 'Partidas', route: '/tabs/matches' },
  { id: 'analytics', label: 'Estadísticas', route: '/tabs/analytics', tone: 'cyan' },
  { id: 'ai-coach', label: 'AI Coach', route: '/tabs/ai-coach', tone: 'purple', badge: 'AI' },
];

/** Items fijos de cuenta en el dropdown del avatar. */
export const APP_ACCOUNT_MENU_ITEMS: AppAccountMenuItem[] = [
  { id: 'settings', label: 'Configuración', route: '/tabs/settings' },
  { id: 'integrations', label: 'Integraciones', route: '/tabs/integrations' },
];

export const APP_ROUTE_TITLES: Record<string, string> = {
  dashboard: 'Overview',
  matches: 'Partidas',
  analytics: 'Estadísticas',
  integrations: 'Integraciones',
  'ai-coach': 'AI Coach',
  settings: 'Configuración',
};
