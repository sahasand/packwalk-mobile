import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'premium' | 'subtle' | 'info';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  icon,
  style,
}: BadgeProps) {
  // Check if children is a string/number to wrap in Text, otherwise render as-is
  const isTextContent = typeof children === 'string' || typeof children === 'number';

  // Wrap any raw text children in Text components to prevent RN errors
  const safeChildren = React.Children.map(children, (child) => {
    if (typeof child === 'string' || typeof child === 'number') {
      return (
        <Text style={[styles.text, styles[`text_${variant}`], styles[`textSize_${size}`]]}>
          {child}
        </Text>
      );
    }
    return child;
  });

  return (
    <View style={[styles.base, styles[variant], styles[`size_${size}`], style]}>
      {icon && <View style={styles.icon}>{icon}</View>}
      {isTextContent ? (
        <Text style={[styles.text, styles[`text_${variant}`], styles[`textSize_${size}`]]}>
          {children}
        </Text>
      ) : (
        <View style={styles.customContent}>{safeChildren}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.full,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },

  icon: {
    marginRight: spacing.xs,
  },

  customContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Variants - sophisticated, muted tones
  default: {
    backgroundColor: colors.paperDark,
  },
  success: {
    backgroundColor: colors.sageLight,
  },
  warning: {
    backgroundColor: colors.goldLight,
  },
  error: {
    backgroundColor: '#FEE9E9',
  },
  premium: {
    backgroundColor: colors.emberGlow,
  },
  subtle: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.stone,
  },
  info: {
    backgroundColor: colors.sageLight,
  },

  // Sizes - refined proportions
  size_sm: {
    paddingVertical: spacing['2xs'] + 1,
    paddingHorizontal: spacing.sm,
  },
  size_md: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md - 4,
  },

  // Text - uppercase tracking for premium feel
  text: {
    fontWeight: typography.weights.medium,
    letterSpacing: typography.tracking.wider,
    textTransform: 'uppercase',
  },
  text_default: {
    color: colors.inkMuted,
  },
  text_success: {
    color: colors.sageDark,
  },
  text_warning: {
    color: colors.gold,
  },
  text_error: {
    color: colors.error,
  },
  text_premium: {
    color: colors.emberDark,
  },
  text_subtle: {
    color: colors.inkMuted,
  },
  text_info: {
    color: colors.sage,
  },

  textSize_sm: {
    fontSize: 12, // Minimum accessible font size (was 10px)
  },
  textSize_md: {
    fontSize: 12, // Minimum accessible font size (was 11px)
  },
});

export default Badge;
