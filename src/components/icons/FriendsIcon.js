import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export default function FriendsIcon({
  size = 24,
  color = '#ffffff',
  filled = false,
  strokeWidth = 2,
  style,
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      {/* Main user */}
      <Circle
        cx="9"
        cy="7"
        r="4"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={filled ? 0 : strokeWidth}
      />
      <Path
        d="M2 20a7 7 0 0 1 14 0"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={filled ? 0 : strokeWidth}
        strokeLinecap="round"
      />
      {/* Secondary user */}
      <Path
        d="M16 3.13a4 4 0 0 1 0 7.75"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M22 20a6 6 0 0 0-6-6"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}
