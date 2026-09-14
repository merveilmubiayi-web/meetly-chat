import React from 'react';
import Svg, { Path } from 'react-native-svg';

export default function SendIcon({
  size = 22,
  color = '#ffffff',
  style,
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path
        d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"
        fill={color}
      />
    </Svg>
  );
}

