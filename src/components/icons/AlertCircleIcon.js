import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export default function AlertCircleIcon({
  size = 14,
  color = '#ef4444',
  style,
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Circle cx="12" cy="12" r="10" fill="none" stroke={color} strokeWidth={2} />
      <Path d="M12 8v4M12 16h.01" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

