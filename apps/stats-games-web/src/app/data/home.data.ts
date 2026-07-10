export interface HomeFeature {
  id: string;
  title: string;
  description: string;
  icon: string;
  tone: 'lime' | 'purple' | 'cyan' | 'pink';
}

export interface HomeStat {
  label: string;
  value: string;
  tone: 'lime' | 'purple' | 'cyan';
}

export const HOME_STATS: HomeStat[] = [
  { label: 'Partidas trackeadas', value: '2.4M+', tone: 'cyan' },
  { label: 'Jugadores activos', value: '18K', tone: 'cyan' },
  { label: 'Eventos live / día', value: '340K', tone: 'purple' },
  { label: 'Plataformas', value: '2', tone: 'cyan' },
];

export const HOME_FEATURES: HomeFeature[] = [
  {
    id: 'live',
    title: 'Live Feed',
    description: 'Eventos de partida en tiempo real vía AppSync. Sin refrescar la página.',
    icon: '📡',
    tone: 'cyan',
  },
  {
    id: 'stats',
    title: 'Analytics profundo',
    description: 'K/D, placement, tendencias diarias y rollups semanales por plataforma.',
    icon: '📊',
    tone: 'cyan',
  },
  {
    id: 'profile',
    title: 'Perfil público',
    description: 'Compartí tu gamer tag. Buscá jugadores y mirá su historial.',
    icon: '🔗',
    tone: 'purple',
  },
  {
    id: 'ai',
    title: 'AI Coach',
    description: 'Insights post-partida y recomendaciones para subir de rank.',
    icon: '🧠',
    tone: 'pink',
  },
  {
    id: 'multi',
    title: 'Multi-plataforma',
    description: 'Roblox y Fortnite en un solo command center con switch global.',
    icon: '🎮',
    tone: 'lime',
  },
  {
    id: 'ranked',
    title: 'Leaderboards',
    description: 'Compará tu rendimiento con la comunidad global.',
    icon: '🏆',
    tone: 'purple',
  },
];
