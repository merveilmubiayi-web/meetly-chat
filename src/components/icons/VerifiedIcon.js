import React from 'react';
import Svg, { Path } from 'react-native-svg';

export default function VerifiedIcon({
  size = 24,
  color = '#a613c4',
  checkColor = '#ffffff',
  style,
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path
        d="M12 2l2.4 2.5 3.4-.6 1.4 3.2 3.3 1.2-.5 3.5 2.1 2.8-2.1 2.8.5 3.5-3.3 1.2-1.4 3.2-3.4-.6L12 22l-2.4-2.5-3.4.6-1.4-3.2-3.3-1.2.5-3.5-2.1-2.8 2.1-2.8-.5-3.5 3.3-1.2 1.4-3.2 3.4.6L12 2z"
        fill={color}
      />
      <Path
        d="M8.5 12.5l2.5 2.5 5-5"
        fill="none"
        stroke={checkColor}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
