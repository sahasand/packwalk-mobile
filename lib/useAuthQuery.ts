import { useQuery, useMutation, useAction } from 'convex/react';
import { useAppStore } from '@/stores/appStore';
import type { FunctionReference } from 'convex/server';
import { useMemo } from 'react';

/**
 * Wrapper around useQuery that skips the query when not logged in.
 * Use this for any authenticated query instead of useQuery directly.
 *
 * Usage:
 * - useAuthQuery(query, args) - normal query
 * - useAuthQuery(query, args, { skip: true }) - skip query
 * - useAuthQuery(query, 'skip') - skip query (Convex-style)
 */
export function useAuthQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  args: Query['_args'] | 'skip',
  options?: { skip?: boolean }
) {
  const { isLoggedIn } = useAppStore();

  // Compute args, or 'skip' if not logged in
  const queryArgs = useMemo(() => {
    if (!isLoggedIn || options?.skip || args === 'skip') {
      return 'skip' as const;
    }
    return args;
  }, [args, isLoggedIn, options?.skip]);

  return useQuery(query, queryArgs as any);
}

/**
 * Wrapper around useMutation.
 * Kept for API compatibility - can be replaced with useMutation directly.
 */
export function useAuthMutation<Mutation extends FunctionReference<'mutation'>>(
  mutation: Mutation
) {
  return useMutation(mutation);
}

/**
 * Wrapper around useAction.
 * Kept for API compatibility - can be replaced with useAction directly.
 */
export function useAuthAction<Action extends FunctionReference<'action'>>(
  action: Action
) {
  return useAction(action);
}
