export function extractGraphqlErrorMessage(error: unknown, fallback = 'Error de GraphQL'): string {
  if (error instanceof Error && error.message && !isOpaqueAmplifyMessage(error.message)) {
    const nested = extractFromErrorsObject(error);
    return nested || error.message;
  }

  const fromObject = extractFromErrorsObject(error);
  if (fromObject) return fromObject;

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return fallback;
}

function isOpaqueAmplifyMessage(message: string): boolean {
  return (
    message === 'GraphQL error' ||
    message === 'Unknown error' ||
    message.toLowerCase().includes('graphqlapi')
  );
}

function extractFromErrorsObject(error: unknown): string | null {
  if (!error || typeof error === 'string' || typeof error !== 'object') {
    return null;
  }

  const err = error as {
    message?: string;
    errors?: Array<{ message?: string; errorType?: string; errorInfo?: unknown }>;
    cause?: unknown;
    data?: unknown;
  };

  const parts = (err.errors ?? [])
    .map((e) => e.message?.trim())
    .filter((m): m is string => !!m);

  if (parts.length) {
    return parts.join('; ');
  }

  if (err.cause) {
    const nested = extractGraphqlErrorMessage(err.cause, '');
    if (nested) return nested;
  }

  if (err.message?.trim()) {
    return err.message.trim();
  }

  return null;
}

export function assertGraphqlData<T>(result: {
  data?: T;
  errors?: Array<{ message?: string }>;
}): T {
  if (result.errors?.length) {
    throw new Error(
      result.errors.map((e) => e.message).filter(Boolean).join('; ') || 'GraphQL error',
    );
  }
  if (result.data == null) {
    throw new Error('Respuesta GraphQL sin data');
  }
  return result.data;
}

/** Mensaje amigable para fallos de vínculo de plataforma. */
export function mapLinkPlatformError(error: unknown): string {
  const raw = extractGraphqlErrorMessage(error, 'No se pudo vincular la cuenta');
  const lower = raw.toLowerCase();

  if (
    lower.includes('playernotfound') ||
    lower.includes('perfil de jugador no encontrado') ||
    lower.includes('no encontrado')
  ) {
    return 'No encontramos tu perfil en el servidor. Probá de nuevo: vamos a crearlo y vincular la cuenta.';
  }

  if (lower.includes('unauthorized') || lower.includes('not authorized')) {
    return 'Sin permiso para vincular. Cerrá sesión y volvé a entrar.';
  }

  if (lower.includes('network') || lower.includes('failed to fetch')) {
    return 'Error de red al hablar con AppSync. Revisá tu conexión.';
  }

  return raw;
}
