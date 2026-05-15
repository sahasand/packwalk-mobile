import React from 'react';
import { View, StyleSheet, ViewStyle, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { colors, radius, shadows, spacing, animation } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'outlined' | 'glass' | 'paper';
  onPress?: () => void;
  padding?: keyof typeof spacing | number;
  noPadding?: boolean;
}

export const Card = React.memo(function Card({
  children,
  style,
  variant = 'default',
  onPress,
  padding = 'md',
  noPadding = false,
}: CardProps) {
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      pressed.value,
      [0, 1],
      [0, 2],
      Extrapolation.CLAMP
    );

    return {
      transform: [
        { scale: scale.value },
        { translateY },
      ],
    };
  });

  const handlePressIn = () => {
    if (onPress) {
      scale.value = withSpring(0.985, animation.spring.gentle);
      pressed.value = withTiming(1, { duration: animation.fast });
    }
  };

  const handlePressOut = () => {
    if (onPress) {
      scale.value = withSpring(1, animation.spring.gentle);
      pressed.value = withTiming(0, { duration: animation.normal });
    }
  };

  const paddingValue = noPadding ? 0 : typeof padding === 'number' ? padding : spacing[padding];

  const cardStyles = [
    styles.base,
    styles[variant],
    { padding: paddingValue },
    style,
  ];

  if (onPress) {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[cardStyles, animatedStyle]}
      >
        {children}
      </AnimatedPressable>
    );
  }

  return <View style={cardStyles}>{children}</View>;
});

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },

  default: {
    ...shadows.soft,
  },

  elevated: {
    ...shadows.elevated,
  },

  outlined: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.stone,
    shadowOpacity: 0,
    elevation: 0,
  },

  glass: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    ...shadows.soft,
  },

  paper: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.paperDark,
    shadowOpacity: 0,
    elevation: 0,
  },
});

export default Card;
