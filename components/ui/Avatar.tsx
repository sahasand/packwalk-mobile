import React, { useEffect } from 'react';
import { View, Image, Text, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { colors, radius, shadows, animation, typography } from '@/constants/theme';

interface AvatarProps {
  source?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  style?: ViewStyle;
  showRing?: boolean;
  showBorder?: boolean; // Alias for showRing
  ringColor?: string;
  online?: boolean;
  verified?: boolean;
}

const sizes = {
  xs: 28,
  sm: 36,
  md: 48,
  lg: 64,
  xl: 88,
  '2xl': 120,
};

const fontSizes = {
  xs: 10,
  sm: 12,
  md: 16,
  lg: 22,
  xl: 30,
  '2xl': 42,
};

const ringWidths = {
  xs: 1.5,
  sm: 2,
  md: 2,
  lg: 2.5,
  xl: 3,
  '2xl': 3.5,
};

export function Avatar({
  source,
  name,
  size = 'md',
  style,
  showRing = false,
  showBorder = false,
  ringColor = colors.ember,
  online = false,
  verified = false,
}: AvatarProps) {
  // showBorder is an alias for showRing
  const displayRing = showRing || showBorder;
  const dimension = sizes[size];
  const fontSize = fontSizes[size];
  const ringWidth = ringWidths[size];
  const ringPulse = useSharedValue(1);

  useEffect(() => {
    if (online) {
      // Subtle opacity-only breathing effect (no distracting scale)
      ringPulse.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.8, { duration: 2000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    }
  }, [online]);

  const ringAnimatedStyle = useAnimatedStyle(() => ({
    opacity: ringPulse.value,
  }));

  const getInitials = (name?: string) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const indicatorSize = Math.max(dimension * 0.22, 10);

  const containerStyle = [
    styles.container,
    {
      width: dimension,
      height: dimension,
      borderRadius: dimension / 2,
    },
    displayRing && {
      borderWidth: ringWidth,
      borderColor: ringColor,
    },
    style,
  ];

  return (
    <View style={styles.wrapper}>
      {/* Animated ring for online status */}
      {online && (
        <Animated.View
          style={[
            styles.onlineRing,
            {
              width: dimension + 8,
              height: dimension + 8,
              borderRadius: (dimension + 8) / 2,
              borderColor: colors.sage,
            },
            ringAnimatedStyle,
          ]}
        />
      )}

      <View style={containerStyle}>
        {source ? (
          <Image
            source={{ uri: source }}
            style={[
              styles.image,
              {
                width: dimension - (displayRing ? ringWidth * 2 : 0),
                height: dimension - (displayRing ? ringWidth * 2 : 0),
                borderRadius: (dimension - (displayRing ? ringWidth * 2 : 0)) / 2,
              },
            ]}
          />
        ) : (
          <View style={[styles.placeholder, containerStyle]}>
            <Text
              style={[
                styles.initials,
                {
                  fontSize,
                  letterSpacing: typography.tracking.tight,
                },
              ]}
            >
              {getInitials(name)}
            </Text>
          </View>
        )}
      </View>

      {/* Online indicator */}
      {online && (
        <View
          style={[
            styles.indicator,
            styles.onlineIndicator,
            {
              width: indicatorSize,
              height: indicatorSize,
              borderRadius: indicatorSize / 2,
              right: displayRing ? -2 : 0,
              bottom: displayRing ? -2 : 0,
            },
          ]}
        />
      )}

      {/* Verified badge */}
      {verified && !online && (
        <View
          style={[
            styles.indicator,
            styles.verifiedIndicator,
            {
              width: indicatorSize,
              height: indicatorSize,
              borderRadius: indicatorSize / 2,
              right: displayRing ? -2 : 0,
              bottom: displayRing ? -2 : 0,
            },
          ]}
        >
          <Text style={[styles.verifiedIcon, { fontSize: indicatorSize * 0.6 }]}>
            ✓
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },

  container: {
    overflow: 'hidden',
    backgroundColor: colors.paperDark,
    alignItems: 'center',
    justifyContent: 'center',
  },

  image: {
    resizeMode: 'cover',
  },

  placeholder: {
    backgroundColor: colors.emberGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },

  initials: {
    color: colors.ember,
    fontWeight: typography.weights.semibold,
  },

  onlineRing: {
    position: 'absolute',
    borderWidth: 2,
    backgroundColor: 'transparent',
  },

  indicator: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.white,
    ...shadows.subtle,
  },

  onlineIndicator: {
    backgroundColor: colors.sage,
  },

  verifiedIndicator: {
    backgroundColor: colors.ember,
    alignItems: 'center',
    justifyContent: 'center',
  },

  verifiedIcon: {
    color: colors.white,
    fontWeight: typography.weights.bold,
  },
});

export default Avatar;
