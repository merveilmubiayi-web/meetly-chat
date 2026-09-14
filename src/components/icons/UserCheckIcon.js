import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

export default function UserCheckIcon({ size = 24, color = '#ffffff', strokeWidth = 2, style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="9" cy="7" r="4" stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Path
        d="M16 11l2 2 4-4"
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
