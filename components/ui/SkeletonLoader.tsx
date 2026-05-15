import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';

import { colors, radius, spacing } from '@/constants/theme';

interface SkeletonLoaderProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
  variant?: 'default' | 'card' | 'text' | 'avatar' | 'button' | 'listItem' | 'stat' | 'walkCard';
}

export function SkeletonLoader({
  width = '100%' as const,
  height = 20,
  borderRadius = radius.md,
  style,
  variant: _variant = 'default', // variant is accepted but styling is unified
}: SkeletonLoaderProps) {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.4, 0.7, 0.4]),
  }));

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius },
        animatedStyle,
        style,
      ]}
    />
  );
}

// Pre-built skeleton variants for common patterns
export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <SkeletonLoader width={48} height={48} borderRadius={radius.lg} />
        <View style={styles.cardHeaderText}>
          <SkeletonLoader width={120} height={16} />
          <SkeletonLoader width={80} height={12} style={{ marginTop: spacing.xs }} />
        </View>
      </View>
      <SkeletonLoader height={14} style={{ marginTop: spacing.md }} />
      <SkeletonLoader width="70%" height={14} style={{ marginTop: spacing.xs }} />
    </View>
  );
}

export function SkeletonListItem() {
  return (
    <View style={styles.listItem}>
      <SkeletonLoader width={44} height={44} borderRadius={radius.full} />
      <View style={styles.listItemContent}>
        <SkeletonLoader width={140} height={16} />
        <SkeletonLoader width={100} height={12} style={{ marginTop: spacing.xs }} />
      </View>
      <SkeletonLoader width={60} height={24} borderRadius={radius.lg} />
    </View>
  );
}

export function SkeletonWalkCard() {
  return (
    <View style={styles.walkCard}>
      <View style={styles.cardHeader}>
        <SkeletonLoader width={52} height={52} borderRadius={radius.lg} />
        <View style={styles.cardHeaderText}>
          <SkeletonLoader width={100} height={16} />
          <SkeletonLoader width={60} height={12} style={{ marginTop: spacing.xs }} />
        </View>
        <SkeletonLoader width={50} height={24} />
      </View>
      <View style={styles.walkDetails}>
        <SkeletonLoader width="60%" height={14} />
        <SkeletonLoader width="40%" height={14} style={{ marginTop: spacing.xs }} />
      </View>
      <SkeletonLoader height={48} borderRadius={radius.xl} style={{ marginTop: spacing.md }} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.stone,
  },

  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.stone,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  cardHeaderText: {
    flex: 1,
    marginLeft: spacing.md,
  },

  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },

  listItemContent: {
    flex: 1,
    marginLeft: spacing.md,
  },

  walkCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.stone,
  },

  walkDetails: {
    marginTop: spacing.md,
  },
});
