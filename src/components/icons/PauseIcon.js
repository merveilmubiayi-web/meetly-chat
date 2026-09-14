import React from 'react';
import Svg, { Path } from 'react-native-svg';

export default function PauseIcon({
  size = 20,
  color = '#ffffff',
  style,
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path
        d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"
        fill={color}
      />
    </Svg>
  );
}

