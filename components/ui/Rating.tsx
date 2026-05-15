import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Star } from 'lucide-react-native';
import { colors, spacing } from '@/constants/theme';

interface RatingProps {
  value: number;
  maxValue?: number;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  onChange?: (value: number) => void;
  readonly?: boolean;
}

const sizes = {
  sm: 14,
  md: 18,
  lg: 24,
};

const fontSizes = {
  sm: 12,
  md: 14,
  lg: 16,
};

export function Rating({
  value,
  maxValue = 5,
  size = 'md',
  showValue = false,
  onChange,
  readonly = true,
}: RatingProps) {
  const starSize = sizes[size];
  const fontSize = fontSizes[size];

  const handlePress = (index: number) => {
    if (!readonly && onChange) {
      onChange(index + 1);
    }
  };

  const renderStar = (index: number) => {
    const filled = index < Math.floor(value);
    const halfFilled = !filled && index < value && value - index >= 0.5;

    const StarComponent = (
      <Star
        size={starSize}
        color={colors.golden}
        fill={filled || halfFilled ? colors.golden : 'transparent'}
        strokeWidth={2}
      />
    );

    if (readonly) {
      return (
        <View key={index} style={styles.star}>
          {StarComponent}
        </View>
      );
    }

    return (
      <TouchableOpacity
        key={index}
        onPress={() => handlePress(index)}
        style={styles.star}
        activeOpacity={0.7}
      >
        {StarComponent}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.stars}>
        {Array.from({ length: maxValue }, (_, i) => renderStar(i))}
      </View>
      {showValue && (
        <Text style={[styles.value, { fontSize }]}>{value.toFixed(1)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  star: {
    marginHorizontal: 1,
  },
  value: {
    marginLeft: spacing.sm,
    color: colors.bark,
    fontWeight: '600',
  },
});

export default Rating;
