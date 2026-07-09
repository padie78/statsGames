import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const profileGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const userId = auth.userId();
  if (!userId) {
    return router.createUrlTree(['/login']);
  }

  await auth.refreshUserAttributes();

  if (auth.needsOnboarding()) {
    return router.createUrlTree(['/onboarding']);
  }

  return true;
};
