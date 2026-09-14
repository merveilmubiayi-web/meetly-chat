import React from 'react';
import Svg, { Path } from 'react-native-svg';

export default function PollIcon({
  size = 22,
  color = '#ffffff',
  style,
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path
        d="M18 20V10M12 20V4M6 20v-6"
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

