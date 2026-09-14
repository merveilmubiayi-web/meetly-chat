import React from 'react';
import Svg, { Path } from 'react-native-svg';

export default function ZapIcon({
  size = 22,
  color = '#ffffff',
  style,
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path
        d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
        fill={color}
      />
    </Svg>
  );
}

