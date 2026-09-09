import React from 'react';
import Svg, { Path } from 'react-native-svg';

export default function MessagesIcon({
  size = 24,
  color = '#ffffff',
  filled = false,
  strokeWidth = 2,
  style,
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path
        d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={filled ? 0 : strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Inner chat lines */}
      <Path
        d="M8 9h8M8 13h5"
        fill="none"
        stroke={filled ? '#0a0a0c' : color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}
