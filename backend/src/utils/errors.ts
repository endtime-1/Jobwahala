import { reportError } from '../config/sentry';

export const getErrorMessage = (error: unknown, fallback = 'Something went wrong'): string => {
  // Almost every controller turns a thrown error into a 500 here, so this is where they are reported.
  reportError(error);
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return fallback;
};
