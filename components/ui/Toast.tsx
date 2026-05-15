import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideOutUp,
} from 'react-native-reanimated';
import { Check, AlertCircle, Info, X } from 'lucide-react-native';

import { colors, spacing, radius, shadows, typography, iconSizes, animation } from '@/constants/theme';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  visible: boolean;
  message: string;
  variant?: ToastVariant;
  duration?: number;
  onDismiss: () => void;
  action?: {
    label: string;
    onPress: () => void;
  };
}

const variantConfig = {
  success: {
    icon: Check,
    backgroundColor: colors.sageLight,
    borderColor: colors.sage,
    iconColor: colors.sage,
    textColor: colors.sageDark,
  },
  error: {
    icon: AlertCircle,
    backgroundColor: '#FEE9E9',
    borderColor: colors.error,
    iconColor: colors.error,
    textColor: '#8B3232',
  },
  info: {
    icon: Info,
    backgroundColor: colors.paperDark,
    borderColor: colors.stone,
    iconColor: colors.inkMuted,
    textColor: colors.ink,
  },
  warning: {
    icon: AlertCircle,
    backgroundColor: colors.goldLight,
    borderColor: colors.gold,
    iconColor: colors.gold,
    textColor: '#7A6320',
  },
};

export function Toast({
  visible,
  message,
  variant = 'info',
  duration = 4000,
  onDismiss,
  action,
}: ToastProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  useEffect(() => {
    if (visible && duration > 0) {
      const timer = setTimeout(() => {
        onDismiss();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration, onDismiss]);

  if (!visible) return null;

  return (
    <Animated.View
      entering={SlideInUp.springify().damping(20).stiffness(200)}
      exiting={SlideOutUp.duration(200)}
      style={[
        styles.container,
        {
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Icon size={iconSizes.sm} color={config.iconColor} strokeWidth={2} />
        </View>

        <Text style={[styles.message, { color: config.textColor }]} numberOfLines={4}>
          {message}
        </Text>

        {action && (
          <Pressable
            onPress={action.onPress}
            style={styles.actionButton}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <Text style={[styles.actionText, { color: config.iconColor }]}>
              {action.label}
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={onDismiss}
          style={styles.dismissButton}
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
        >
          <X size={iconSizes.xs} color={config.iconColor} strokeWidth={2} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

// Toast Manager Hook
import { create } from 'zustand';

interface ToastState {
  visible: boolean;
  message: string;
  variant: ToastVariant;
  action?: { label: string; onPress: () => void };
  show: (message: string, variant?: ToastVariant, action?: { label: string; onPress: () => void }) => void;
  hide: () => void;
}

export const useToast = create<ToastState>((set) => ({
  visible: false,
  message: '',
  variant: 'info',
  action: undefined,
  show: (message, variant = 'info', action) =>
    set({ visible: true, message, variant, action }),
  hide: () => set({ visible: false, message: '', action: undefined }),
}));

// Toast Container - place at root of app
export function ToastContainer() {
  const { visible, message, variant, action, hide } = useToast();

  return (
    <View style={styles.toastContainer} pointerEvents="box-none">
      <Toast
        visible={visible}
        message={message}
        variant={variant}
        action={action}
        onDismiss={hide}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 9999,
  },

  container: {
    borderRadius: radius.lg,
    borderWidth: 1,
    ...shadows.elevated,
  },

  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },

  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  message: {
    flex: 1,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    lineHeight: typography.sizes.sm * typography.leading.snug,
  },

  actionButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },

  actionText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },

  dismissButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
});
