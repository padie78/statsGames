export interface LeaderboardEntry {
  rank: number;
  gamerTag: string;
  platform: 'fortnite' | 'roblox';
  score: number;
  delta: string;
  trend: 'up' | 'down' | 'flat';
}

export interface TrendingItem {
  id: string;
  label: string;
  meta: string;
  tone: 'lime' | 'purple' | 'cyan' | 'pink';
}

export interface AchievementItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  tone: 'lime' | 'purple' | 'pink' | 'cyan';
}

export interface LiveTickerItem {
  id: string;
  text: string;
  tone: 'lime' | 'purple' | 'cyan';
}

export const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, gamerTag: 'NeoFragger', platform: 'fortnite', score: 2840, delta: '+12%', trend: 'up' },
  { rank: 2, gamerTag: 'ShadowAim', platform: 'fortnite', score: 2712, delta: '+8%', trend: 'up' },
  { rank: 3, gamerTag: 'UpStatsPro', platform: 'roblox', score: 2655, delta: '+5%', trend: 'up' },
  { rank: 4, gamerTag: 'PixelQueen', platform: 'roblox', score: 2490, delta: '-2%', trend: 'down' },
  { rank: 5, gamerTag: 'TRN_Demo', platform: 'fortnite', score: 2388, delta: '+3%', trend: 'up' },
];

export const MOCK_TRENDING: TrendingItem[] = [
  { id: '1', label: 'Zero Build ranked surge', meta: 'Fortnite · +18% players', tone: 'cyan' },
  { id: '2', label: 'Blox Fruits PvP meta shift', meta: 'Roblox · Hot today', tone: 'purple' },
  { id: '3', label: 'Placement avg improving', meta: 'Community · Top 15%', tone: 'cyan' },
  { id: '4', label: 'New season challenges', meta: 'S37 · 4d left', tone: 'pink' },
];

export const MOCK_ACHIEVEMENTS: AchievementItem[] = [
  { id: 'streak', title: 'Win streak', subtitle: '3 strong sessions', icon: '🔥', tone: 'lime' },
  { id: 'top', title: 'Top 12%', subtitle: 'Placement this week', icon: '⚡', tone: 'purple' },
  { id: 'grind', title: 'Grinder', subtitle: '10+ matches logged', icon: '💀', tone: 'pink' },
  { id: 'clutch', title: 'Clutch kills', subtitle: 'Best: 12 eliminations', icon: '🎯', tone: 'cyan' },
];

export const MOCK_TICKER: LiveTickerItem[] = [
  { id: '1', text: 'NeoFragger just hit #4 placement', tone: 'cyan' },
  { id: '2', text: '2.4M matches tracked last 24h', tone: 'cyan' },
  { id: '3', text: 'UpStatsPro climbed +5 ranks', tone: 'purple' },
  { id: '4', text: 'Live feed active in eu-central-1', tone: 'cyan' },
];

export const DASHBOARD_QUICK_ACTIONS = [
  { id: 'analytics', label: 'Stats avanzadas', route: '/tabs/analytics', icon: '📊', tone: 'cyan' as const },
  { id: 'matches', label: 'Partidas', route: '/tabs/matches', icon: '⚔', tone: 'lime' as const },
  { id: 'integrations', label: 'Integrar', route: '/tabs/integrations', icon: '🔗', tone: 'purple' as const },
  { id: 'ai', label: 'AI Coach', route: '/tabs/ai-coach', icon: '🧠', tone: 'pink' as const, badge: 'NEW' },
];
