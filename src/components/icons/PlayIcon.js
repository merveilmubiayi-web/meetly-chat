import React from 'react';
import Svg, { Path } from 'react-native-svg';

export default function PlayIcon({
  size = 20,
  color = '#ffffff',
  style,
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path
        d="M8 5v14l11-7z"
        fill={color}
      />
    </Svg>
  );
}

