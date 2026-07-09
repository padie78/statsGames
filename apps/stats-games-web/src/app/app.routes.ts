import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { onboardingGuard } from './core/auth/onboarding.guard';
import { profileGuard } from './core/auth/profile.guard';

export const APP_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'tabs/dashboard' },
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
    loadComponent: () => import('./pages/tabs/tabs.page').then((m) => m.TabsPageComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.page').then((m) => m.DashboardPageComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'tabs/dashboard' },
];
