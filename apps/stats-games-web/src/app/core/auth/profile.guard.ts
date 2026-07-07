import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { PlayerService } from '../../services/player.service';

export const profileGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const player = inject(PlayerService);
  const router = inject(Router);

  const userId = auth.userId();
  if (!userId) {
    return router.createUrlTree(['/login']);
  }

  const profile = await player.getPlayerProfileOrNull(userId);
  if (!profile) {
    return router.createUrlTree(['/onboarding']);
  }

  return true;
};
