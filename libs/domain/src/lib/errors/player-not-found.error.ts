import { DomainError } from './domain-errors';

export class PlayerNotFoundError extends DomainError {
  constructor(userId: string) {
    super(`Perfil de jugador no encontrado: ${userId}`);
  }
}
