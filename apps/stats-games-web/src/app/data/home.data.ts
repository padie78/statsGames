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
  { label: 'Títulos en el hub', value: '8', tone: 'lime' },
];

export const HOME_FEATURES: HomeFeature[] = [
  {
    id: 'live',
    title: 'Feed en vivo',
    description:
      'Cada cierre de partida llega por AppSync. Dashboard y notificaciones sin F5.',
    icon: '📡',
    tone: 'cyan',
  },
  {
    id: 'stats',
    title: 'Stats por título',
    description:
      'K/D, HS%, CS, ADR, placement o badges — métricas nativas del juego activo.',
    icon: '📊',
    tone: 'cyan',
  },
  {
    id: 'profile',
    title: 'Un gamer tag',
    description:
      'Riot, Steam, Epic y Roblox bajo el mismo perfil. Público, buscable y compartible.',
    icon: '🔗',
    tone: 'purple',
  },
  {
    id: 'ai',
    title: 'AI Coach',
    description:
      'Post-partida con Bedrock: glosario del título, errores clave y plan de mejora.',
    icon: '🧠',
    tone: 'pink',
  },
  {
    id: 'multi',
    title: 'Switcher de juegos',
    description:
      'Valorant, LoL, CS2, Rocket League, Fortnite y experiencias Roblox en un chrome.',
    icon: '🎮',
    tone: 'lime',
  },
  {
    id: 'ranked',
    title: 'Leaderboards',
    description:
      'Ranking semanal por comunidad y título. Medí dónde estás vs el promedio.',
    icon: '🏆',
    tone: 'purple',
  },
];
