import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export default function LocationIcon({
  size = 22,
  color = '#ffffff',
  style,
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path
        d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="10" r="3" fill="none" stroke={color} strokeWidth={2} />
    </Svg>
  );
}

