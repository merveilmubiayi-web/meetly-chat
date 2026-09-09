import React from 'react';
import Svg, { Path } from 'react-native-svg';

export default function ShareIcon({
  size = 24,
  color = '#ffffff',
  strokeWidth = 2,
  style,
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path
        d="M13 5l7 7-7 7M20 12H9a5 5 0 0 0-5 5v2"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
