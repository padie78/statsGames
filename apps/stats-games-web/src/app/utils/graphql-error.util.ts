export function extractGraphqlErrorMessage(error: unknown, fallback = 'Error de GraphQL'): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (!error || typeof error !== 'object') {
    return fallback;
  }

  const err = error as {
    message?: string;
    errors?: Array<{ message?: string; errorType?: string }>;
  };

  const nested = err.errors?.map((e) => e.message).filter(Boolean).join('; ');
  if (nested) return nested;
  if (err.message) return err.message;

  return fallback;
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
