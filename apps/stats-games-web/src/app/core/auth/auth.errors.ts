export class AuthPendingConfirmationError extends Error {
  constructor(
    readonly email: string,
    readonly password: string,
  ) {
    super('Tenés que confirmar tu email antes de ingresar. Te reenviamos el código.');
    this.name = 'AuthPendingConfirmationError';
  }
}

export function mapAuthErrorMessage(err: unknown): string {
  if (err instanceof AuthPendingConfirmationError) {
    return err.message;
  }

  if (!(err instanceof Error)) {
    return 'Error de autenticación';
  }

  const name = err.name;
  const message = err.message;

  if (name === 'UserNotConfirmedException' || message.includes('User is not confirmed')) {
    return 'Tu cuenta no está confirmada. Revisá el código que te enviamos por email.';
  }
  if (name === 'NotAuthorizedException' || message.includes('Incorrect username or password')) {
    return 'Email o contraseña incorrectos.';
  }
  if (name === 'UserAlreadyAuthenticatedException') {
    return 'Ya tenés una sesión activa.';
  }
  if (name === 'PasswordResetRequiredException') {
    return 'Tenés que restablecer tu contraseña antes de ingresar.';
  }

  return message || 'Error de autenticación';
}
