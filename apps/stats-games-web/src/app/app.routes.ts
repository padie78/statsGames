import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { onboardingGuard } from './core/auth/onboarding.guard';
import { profileGuard } from './core/auth/profile.guard';

const placeholder = (title: string, description: string) => ({
  placeholderTitle: title,
  placeholderDescription: description,
});

export const APP_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePageComponent),
  },
  {
    path: 'player/:gamerTag',
    loadComponent: () =>
      import('./pages/player-public/player-public.page').then((m) => m.PlayerPublicPageComponent),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/auth/auth-entry.page').then((m) => m.AuthEntryPageComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/auth/auth-entry.page').then((m) => m.AuthEntryPageComponent),
  },
  {
    path: 'auth/callback',
    loadComponent: () => import('./pages/auth/callback.page').then((m) => m.AuthCallbackPageComponent),
  },
  {
    path: 'onboarding',
    canActivate: [authGuard, onboardingGuard],
    loadComponent: () =>
      import('./pages/auth/onboarding.page').then((m) => m.OnboardingPageComponent),
  },
  {
    path: 'tabs',
    canActivate: [authGuard, profileGuard],
    loadComponent: () => import('./pages/shell/shell.page').then((m) => m.ShellPageComponent),
    children: [
      { path: '', pathMatch: 'full', loadComponent: () =>
          import('./pages/role-home-redirect.page').then((m) => m.RoleHomeRedirectPageComponent),
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.page').then((m) => m.DashboardPageComponent),
      },
      {
        path: 'matches',
        loadComponent: () =>
          import('./pages/matches/matches.page').then((m) => m.MatchesPageComponent),
      },
      {
        path: 'matches/:matchId',
        loadComponent: () =>
          import('./pages/matches/match-detail.page').then((m) => m.MatchDetailPageComponent),
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./pages/analytics/analytics.page').then((m) => m.AnalyticsPageComponent),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/profile/profile.page').then((m) => m.ProfilePageComponent),
      },
      {
        path: 'talent',
        loadComponent: () =>
          import('./pages/scout/talent-search.page').then((m) => m.TalentSearchPageComponent),
      },
      {
        path: 'radar',
        loadComponent: () =>
          import('./pages/scout/radar.page').then((m) => m.RadarPageComponent),
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./pages/scout/reports.page').then((m) => m.ReportsPageComponent),
      },
      {
        path: 'team',
        loadComponent: () =>
          import('./pages/scout/team.page').then((m) => m.TeamPageComponent),
      },
      {
        path: 'integrations',
        loadComponent: () =>
          import('./pages/integrations/integrations.page').then((m) => m.IntegrationsPageComponent),
      },
      {
        path: 'ai-coach',
        loadComponent: () =>
          import('./pages/ai-coach/ai-coach.page').then((m) => m.AiCoachPageComponent),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./pages/settings/settings.page').then((m) => m.SettingsPageComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
