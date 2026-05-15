import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { Button } from './Button';
import { PawIcon } from './PawIcon';
import { colors, spacing, radius, typography } from '@/constants/theme';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
  variant?: 'default' | 'compact';
}

export function EmptyState({
  icon,
  title,
  subtitle,
  ctaLabel,
  onCtaPress,
  variant = 'default',
}: EmptyStateProps) {
  const isCompact = variant === 'compact';

  return (
    <Animated.View
      entering={FadeIn.delay(100).duration(400)}
      style={[styles.container, isCompact && styles.containerCompact]}
    >
      <Animated.View
        entering={FadeInUp.delay(150).duration(500)}
        style={styles.iconWrapper}
      >
        {icon || (
          <View style={[styles.defaultIcon, isCompact && styles.defaultIconCompact]}>
            <PawIcon
              size={isCompact ? 40 : 60}
              color={colors.stone}
              filled
            />
          </View>
        )}
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(200).duration(500)}
        style={styles.textContainer}
      >
        <Text style={[styles.title, isCompact && styles.titleCompact]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.subtitle, isCompact && styles.subtitleCompact]}>
            {subtitle}
          </Text>
        )}
      </Animated.View>

      {ctaLabel && onCtaPress && (
        <Animated.View
          entering={FadeInUp.delay(300).duration(500)}
          style={styles.ctaContainer}
        >
          <Button
            variant="primary"
            size={isCompact ? 'sm' : 'md'}
            onPress={onCtaPress}
          >
            {ctaLabel}
          </Button>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.lg,
  },

  containerCompact: {
    paddingVertical: spacing.xl,
  },

  iconWrapper: {
    marginBottom: spacing.lg,
  },

  defaultIcon: {
    width: 100,
    height: 100,
    borderRadius: radius.full,
    backgroundColor: colors.paperDark,
    alignItems: 'center',
    justifyContent: 'center',
  },

  defaultIconCompact: {
    width: 72,
    height: 72,
  },

  textContainer: {
    alignItems: 'center',
    maxWidth: 280,
  },

  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },

  titleCompact: {
    fontSize: typography.sizes.base,
  },

  subtitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: typography.sizes.base * typography.leading.relaxed,
  },

  subtitleCompact: {
    fontSize: typography.sizes.sm,
  },

  ctaContainer: {
    marginTop: spacing.lg,
  },
});
