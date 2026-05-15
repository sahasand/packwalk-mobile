import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { authStorage } from '@/lib/authStorage';
import { useAppStore } from '@/stores/appStore';
import { colors, typography } from '@/constants/theme';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  isRecovering: boolean;
}

/**
 * Check if an error is auth-related (user not found, not authenticated, etc.)
 */
function isAuthError(error: unknown): boolean {
  if (!error) return false;

  // Convert error to string to check all possible formats
  const errorStr = String(error);
  const errorMessage = error instanceof Error ? error.message : '';

  // Check various auth error patterns
  const patterns = [
    'user_not_found',
    'User not found',
    'not_authenticated',
    'Not authenticated',
    'auth/user_not_found',
    'auth/not_authenticated',
    'auth/forbidden',
  ];

  return patterns.some(
    (pattern) =>
      errorStr.includes(pattern) ||
      errorMessage.includes(pattern)
  );
}

/**
 * Error boundary that catches auth-related Convex errors (like "User not found")
 * and gracefully logs the user out instead of crashing.
 */
class AuthErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, isRecovering: false };
  }

  static getDerivedStateFromError(error: unknown): State | null {
    // Always catch and check if it's an auth error
    if (isAuthError(error)) {
      return { hasError: true, isRecovering: true };
    }
    // For non-auth errors, still set hasError but don't recover
    return { hasError: true, isRecovering: false };
  }

  async componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    console.log('[AuthErrorBoundary] Caught error:', error);
    console.log('[AuthErrorBoundary] Error info:', errorInfo);

    if (isAuthError(error)) {
      console.log('[AuthErrorBoundary] Auth error detected, logging out...');

      try {
        // Clear stored token
        await authStorage.clearToken();

        // Reset Zustand store
        useAppStore.getState().setLoggedIn(false);
        useAppStore.getState().setUser(null);

        // Small delay then reset error state to re-render (will redirect to login)
        setTimeout(() => {
          this.setState({ hasError: false, isRecovering: false });
        }, 500);
      } catch (cleanupError) {
        console.error('[AuthErrorBoundary] Cleanup failed:', cleanupError);
      }
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.state.isRecovering) {
        return (
          <View style={styles.container}>
            <Text style={styles.text}>Signing out...</Text>
          </View>
        );
      }
      // Non-auth error - show generic error
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.text}>Please restart the app</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.paper,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    color: colors.inkMuted,
  },
});

export default AuthErrorBoundaryClass;
