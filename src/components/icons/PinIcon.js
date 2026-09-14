import React from 'react';
import Svg, { Line, Path } from 'react-native-svg';

export default function PinIcon({ size = 24, color = '#ffffff', strokeWidth = 2, style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path
        d="M12 2a7 7 0 0 1 7 7c0 5.25-7 13-7 13S5 14.25 5 9a7 7 0 0 1 7-7z"
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
      />
    </Svg>
  );
}
