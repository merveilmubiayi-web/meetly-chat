import React from 'react';
import Svg, { Path } from 'react-native-svg';

export default function BookmarkIcon({
  size = 24,
  color = '#ffffff',
  filled = false,
  strokeWidth = 2,
  style,
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path
        d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={filled ? 0 : strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
