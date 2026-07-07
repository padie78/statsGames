export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InvalidPlatformError extends DomainError {
  constructor(platform: string) {
    super(`Plataforma de juego inválida: ${platform}`);
  }
}

export class MatchAlreadyExistsError extends DomainError {
  constructor(matchId: string) {
    super(`La partida ya existe: ${matchId}`);
  }
}
