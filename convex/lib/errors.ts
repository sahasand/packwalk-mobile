import { ConvexError } from 'convex/values';

export type PackwalkErrorCode =
  | 'auth/not_authenticated'
  | 'auth/user_not_found'
  | 'auth/forbidden'
  | 'rate/limit_exceeded'
  | 'state/invalid_transition'
  | 'stripe/error'
  | 'payments/dev_only'
  | 'payments/connect_required'
  | 'validation/error';

export function packwalkError(
  code: PackwalkErrorCode,
  message: string,
  data?: Record<string, unknown>,
): never {
  throw new ConvexError({ code, message, ...data });
}

/**
 * Extract error info from unknown error for logging.
 * Use this in catch blocks instead of `error: any`.
 */
export function getErrorInfo(error: unknown): { message: string; code?: string } {
  if (error instanceof Error) {
    return {
      message: error.message,
      code: (error as Error & { code?: string }).code,
    };
  }
  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;
    return {
      message: String(obj.message ?? obj.error ?? error),
      code: typeof obj.code === 'string' ? obj.code : undefined,
    };
  }
  return { message: String(error) };
}
