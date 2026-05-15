import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Platform } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { AlertTriangle, Trash2, LogOut, XCircle } from 'lucide-react-native';

import { Button } from './Button';
import { colors, spacing, radius, shadows, typography, iconSizes } from '@/constants/theme';

type DialogVariant = 'danger' | 'warning' | 'info';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: DialogVariant;
  icon?: 'delete' | 'logout' | 'cancel' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const iconMap = {
  delete: Trash2,
  logout: LogOut,
  cancel: XCircle,
  warning: AlertTriangle,
};

const variantConfig = {
  danger: {
    iconBackground: '#FEE9E9',
    iconColor: colors.error,
    confirmVariant: 'primary' as const, // Will be styled as danger
    confirmBackground: colors.error,
  },
  warning: {
    iconBackground: colors.goldLight,
    iconColor: colors.gold,
    confirmVariant: 'primary' as const,
    confirmBackground: colors.gold,
  },
  info: {
    iconBackground: colors.sageLight,
    iconColor: colors.sage,
    confirmVariant: 'secondary' as const,
    confirmBackground: colors.sage,
  },
};

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  icon = 'warning',
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  const config = variantConfig[variant];
  const Icon = iconMap[icon];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onCancel} />

        <Animated.View
          entering={SlideInDown.springify().damping(20).stiffness(200)}
          exiting={SlideOutDown.duration(200)}
          style={styles.dialog}
        >
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: config.iconBackground }]}>
            <Icon size={iconSizes.lg} color={config.iconColor} strokeWidth={1.5} />
          </View>

          {/* Content */}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          {/* Actions */}
          <View style={styles.actions}>
            <View style={styles.buttonWrapper}>
              <Button
                variant="ghost"
                size="lg"
                onPress={onCancel}
                fullWidth
                disabled={loading}
              >
                {cancelLabel}
              </Button>
            </View>

            <View style={styles.buttonWrapper}>
              <Pressable
                style={[
                  styles.confirmButton,
                  { backgroundColor: config.confirmBackground },
                  loading && styles.confirmButtonDisabled,
                ]}
                onPress={onConfirm}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel={confirmLabel}
              >
                <Text style={styles.confirmButtonText}>{confirmLabel}</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 22, 20, 0.5)',
  },

  dialog: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.white,
    borderRadius: radius['2xl'],
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.elevated,
  },

  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },

  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },

  message: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: typography.sizes.base * typography.leading.relaxed,
    marginBottom: spacing.xl,
  },

  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },

  buttonWrapper: {
    flex: 1,
  },

  confirmButton: {
    height: 52,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },

  confirmButtonDisabled: {
    opacity: 0.6,
  },

  confirmButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.white,
    letterSpacing: typography.tracking.wide,
  },
});
