import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export default function ClockIcon({
  size = 13,
  color = 'rgba(255, 255, 255, 0.5)',
  style,
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth={2} />
      <Path d="M12 7v5l3 3" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

