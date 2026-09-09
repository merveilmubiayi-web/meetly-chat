import React from 'react';
import Svg, { Path } from 'react-native-svg';

export default function BackIcon({
  size = 24,
  color = '#ffffff',
  strokeWidth = 2,
  style,
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path
        d="M15 18l-6-6 6-6"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
