import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

export default function VideoIcon({
  size = 24,
  color = '#ffffff',
  strokeWidth = 2,
  style,
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Rect
        x="2"
        y="5"
        width="14"
        height="14"
        rx="2"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M16 10l6-4v12l-6-4"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
