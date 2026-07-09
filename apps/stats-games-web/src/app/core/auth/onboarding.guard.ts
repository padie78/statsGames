import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const onboardingGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    const restored = await auth.restoreSession();
    if (!restored) {
      return router.createUrlTree(['/login']);
    }
  }

  await auth.refreshUserAttributes();

  if (!auth.needsOnboarding()) {
    return router.createUrlTree(['/tabs/dashboard']);
  }

  return true;
};
