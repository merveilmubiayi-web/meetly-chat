import React from 'react';
import Svg, { Path } from 'react-native-svg';

export default function DoubleCheckIcon({
  size = 16,
  color = '#38bdf8',
  style,
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path
        d="M18 6L7 17l-5-5M22 10l-7.5 7.5-1.5-1.5"
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CheckIcon({
  size = 14,
  color = 'rgba(255, 255, 255, 0.6)',
  style,
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path
        d="M20 6L9 17l-5-5"
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

