import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export default function SearchIcon({
  size = 24,
  color = '#ffffff',
  strokeWidth = 2,
  style,
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Circle
        cx="11"
        cy="11"
        r="7.5"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M16.5 16.5L21.5 21.5"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}
