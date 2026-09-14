import React from 'react';
import Svg, { Rect } from 'react-native-svg';

export default function GridIcon({ size = 24, color = '#ffffff', strokeWidth = 2, style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Rect x="3" y="3" width="7" height="7" rx="1.5" stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Rect x="14" y="3" width="7" height="7" rx="1.5" stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Rect x="3" y="14" width="7" height="7" rx="1.5" stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Rect x="14" y="14" width="7" height="7" rx="1.5" stroke={color} strokeWidth={strokeWidth} fill="none" />
    </Svg>
  );
}
