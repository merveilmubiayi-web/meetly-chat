import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export default function MusicIcon({
  size = 24,
  color = '#ffffff',
  strokeWidth = 2,
  style,
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path
        d="M9 18V5l12-2v13"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="6" cy="18" r="3" fill={color} />
      <Circle cx="18" cy="16" r="3" fill={color} />
    </Svg>
  );
}
