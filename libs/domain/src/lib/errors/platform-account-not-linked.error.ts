import { DomainError } from './domain-errors';

export class PlatformAccountNotLinkedError extends DomainError {
  constructor(platform: string, externalId: string) {
    super(`Cuenta de ${platform} no vinculada: ${externalId}`);
  }
}
