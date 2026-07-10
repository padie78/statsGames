export interface AppSubnavItem {
  id: string;
  label: string;
  route: string;
  badge?: string;
  tone?: 'lime' | 'purple' | 'cyan';
}

/** Barra contextual (topbar 2) — secciones del perfil activo. */
export const APP_SUBNAV_ITEMS: AppSubnavItem[] = [
  { id: 'dashboard', label: 'Overview', route: 'dashboard', tone: 'lime' },
  { id: 'matches', label: 'Partidas', route: 'matches', badge: 'LIVE' },
  { id: 'analytics', label: 'Estadísticas', route: 'analytics', tone: 'cyan' },
  { id: 'integrations', label: 'Integraciones', route: 'integrations' },
  { id: 'ai-coach', label: 'AI Coach', route: 'ai-coach', tone: 'purple', badge: 'AI' },
  { id: 'settings', label: 'Config', route: 'settings' },
];

export const APP_ROUTE_TITLES: Record<string, string> = {
  dashboard: 'Overview',
  matches: 'Partidas',
  analytics: 'Estadísticas',
  integrations: 'Integraciones',
  'ai-coach': 'AI Coach',
  settings: 'Configuración',
};
