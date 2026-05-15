import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/constants/theme';

interface PawIconProps {
  size?: number;
  color?: string;
  filled?: boolean;
}

export function PawIcon({
  size = 24,
  color = colors.terracotta,
  filled = true,
}: PawIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Main pad */}
      <Path
        d="M12 17.5C9.5 17.5 7.5 15.5 7.5 13C7.5 10.5 9.5 8.5 12 8.5C14.5 8.5 16.5 10.5 16.5 13C16.5 15.5 14.5 17.5 12 17.5Z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.5}
      />
      {/* Top left toe */}
      <Path
        d="M7 7.5C7 8.5 6.3 9.5 5 9.5C3.7 9.5 3 8.5 3 7.5C3 6.5 3.7 5.5 5 5.5C6.3 5.5 7 6.5 7 7.5Z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.5}
      />
      {/* Top right toe */}
      <Path
        d="M21 7.5C21 8.5 20.3 9.5 19 9.5C17.7 9.5 17 8.5 17 7.5C17 6.5 17.7 5.5 19 5.5C20.3 5.5 21 6.5 21 7.5Z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.5}
      />
      {/* Middle left toe */}
      <Path
        d="M9.5 5C9.5 6 8.8 7 7.5 7C6.2 7 5.5 6 5.5 5C5.5 4 6.2 3 7.5 3C8.8 3 9.5 4 9.5 5Z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.5}
      />
      {/* Middle right toe */}
      <Path
        d="M18.5 5C18.5 6 17.8 7 16.5 7C15.2 7 14.5 6 14.5 5C14.5 4 15.2 3 16.5 3C17.8 3 18.5 4 18.5 5Z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.5}
      />
    </Svg>
  );
}

export default PawIcon;
