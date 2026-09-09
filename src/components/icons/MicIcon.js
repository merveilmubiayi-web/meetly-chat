import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

export default function MicIcon({
  size = 24,
  color = '#ffffff',
  strokeWidth = 2,
  style,
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Rect
        x="9"
        y="2"
        width="6"
        height="12"
        rx="3"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M5 10a7 7 0 0 0 14 0M12 18v4M8 22h8"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
