import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { profileGuard } from './core/auth/profile.guard';

export const APP_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'tabs/dashboard' },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.page').then((m) => m.LoginPageComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/register/register.page').then((m) => m.RegisterPageComponent),
  },
  {
    path: 'onboarding',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/onboarding/onboarding.page').then((m) => m.OnboardingPageComponent),
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
