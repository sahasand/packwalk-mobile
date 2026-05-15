import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { authStorage } from './authStorage';
import { useAppStore } from '@/stores/appStore';

// Session event names for cross-component communication
export const SESSION_EVENTS = {
  EXPIRED: 'packwalk:session-expired',
  EXPIRING: 'packwalk:session-expiring',
  TOKEN_STORED: 'packwalk:token-stored',
} as const;

// Global counter to force re-render when token is stored
let tokenVersion = 0;
const tokenVersionListeners: Set<(resolve: () => void) => void> = new Set();

/**
 * Call this after storing a token to notify useConvexAuth to re-check.
 * This triggers Convex to fetch and use the new token.
 * Returns a promise that resolves when the token state is updated.
 */
export function notifyTokenStored(): Promise<void> {
  tokenVersion++;
  const promises: Promise<void>[] = [];
  tokenVersionListeners.forEach(listener => {
    promises.push(new Promise<void>(resolve => listener(resolve)));
  });
  // If no listeners yet, resolve immediately but wait a tick for React
  if (promises.length === 0) {
    return new Promise(resolve => setTimeout(resolve, 50));
  }
  return Promise.all(promises).then(() => {});
}

/**
 * Decode base64url string (JWT uses base64url, not standard base64)
 */
function base64UrlDecode(str: string): string {
  // Replace base64url characters with base64 equivalents
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  while (base64.length % 4) {
    base64 += '=';
  }
  return atob(base64);
}

/**
 * Decode JWT payload without verification (client-side only for expiration check)
 */
function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

/**
 * Custom hook for Convex auth integration with OAuth tokens.
 * Translates between AsyncStorage-based token management and Convex's auth API.
 */
// Helper to dispatch session events (web only, safe no-op on native)
function dispatchSessionEvent(eventName: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(eventName));
  }
  // For React Native, the state change (setLoggedIn(false)) triggers navigation
}

export function useConvexAuth() {
  const { isLoggedIn, setLoggedIn } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);
  const [hasValidToken, setHasValidToken] = useState(false);
  const expiryWarningShown = useRef(false);

  // Subscribe to token version changes
  useEffect(() => {
    const handleTokenChange = (resolve: () => void) => {
      // Re-check for token when notifyTokenStored is called
      authStorage.getToken().then(token => {
        if (token) {
          const payload = decodeJwtPayload(token);
          if (payload && typeof payload.exp === 'number' && payload.exp * 1000 > Date.now()) {
            setHasValidToken(true);
          }
        }
        // Resolve after state update is queued (but give React time to process)
        setTimeout(resolve, 50);
      });
    };

    tokenVersionListeners.add(handleTokenChange);
    return () => {
      tokenVersionListeners.delete(handleTokenChange);
    };
  }, []);

  // Check for stored token on mount and restore auth state
  useEffect(() => {
    let mounted = true;

    const checkToken = async () => {
      // One-time migration from AsyncStorage to SecureStore
      await authStorage.migrateFromAsyncStorage();

      const token = await authStorage.getToken();
      if (mounted) {
        // If we have a stored token, check if it's valid and not expired
        if (token) {
          const payload = decodeJwtPayload(token);
          if (!payload || typeof payload.exp !== 'number') {
            // Invalid token format - clear it and reset auth state
            await authStorage.clearToken();
            setLoggedIn(false);
            setHasValidToken(false);
            dispatchSessionEvent(SESSION_EVENTS.EXPIRED);
          } else {
            const exp = payload.exp * 1000; // Convert to milliseconds
            const now = Date.now();

            // Only restore auth state if token is still valid
            if (exp > now) {
              setLoggedIn(true);
              setHasValidToken(true);
            } else {
              // Token expired, clear it and dispatch event for consistency
              await authStorage.clearToken();
              setLoggedIn(false);
              setHasValidToken(false);
              dispatchSessionEvent(SESSION_EVENTS.EXPIRED);
            }
          }
        }
        setIsLoading(false);
      }
    };

    checkToken();

    return () => {
      mounted = false;
    };
  }, [setLoggedIn]);

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      // Note: forceRefreshToken is accepted for Convex API compatibility but not used.
      // OAuth ID tokens from Google/Apple cannot be refreshed client-side - they have
      // a fixed ~1 hour lifetime. When the token expires, the user must re-authenticate.
      // A proper refresh token flow would require backend changes (not planned).
      void forceRefreshToken; // Explicitly mark as intentionally unused

      // Get stored JWT token from AsyncStorage
      const token = await authStorage.getToken();

      // If no token available, return null
      if (!token) {
        return null;
      }

      // Check if token is expired (JWT exp claim)
      const payload = decodeJwtPayload(token);
      if (!payload || typeof payload.exp !== 'number') {
        // Invalid token format - clear and return null
        await authStorage.clearToken();
        useAppStore.getState().setLoggedIn(false);
        return null;
      }

      const exp = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();

      // Token already expired - clear and return null (user must re-login)
      if (exp < now) {
        await authStorage.clearToken();
        useAppStore.getState().setLoggedIn(false);
        dispatchSessionEvent(SESSION_EVENTS.EXPIRED);
        return null;
      }

      // Token expires in < 5 min - warn user once
      if (exp - now < 5 * 60 * 1000 && !expiryWarningShown.current) {
        expiryWarningShown.current = true;
        dispatchSessionEvent(SESSION_EVENTS.EXPIRING);
        // Note: Full token refresh would require backend support (refresh token endpoint)
        // For now, we just warn the user and let the token expire naturally
      }

      return token;
    },
    []
  );

  return useMemo(
    () => ({
      isLoading,
      // Auth is ready if user is logged in OR if we have a valid token (during login flow)
      // This ensures Convex sends the token during bootstrapUser even before isLoggedIn is set
      isAuthenticated: isLoggedIn || hasValidToken,
      fetchAccessToken,
    }),
    [isLoading, isLoggedIn, hasValidToken, fetchAccessToken]
  );
}
