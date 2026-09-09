import React from 'react';
import Svg, { Path } from 'react-native-svg';

export default function HomeIcon({
  size = 24,
  color = '#ffffff',
  filled = false,
  strokeWidth = 2,
  style,
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path
        d="M3 10.182V20a2 2 0 0 0 2 2h4a1 1 0 0 0 1-1v-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5a1 1 0 0 0 1 1h4a2 2 0 0 0 2-2v-9.818a2 2 0 0 0-.757-1.562L13.243 2.89a2 2 0 0 0-2.486 0L3.757 8.62A2 2 0 0 0 3 10.182z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={filled ? 0 : strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
