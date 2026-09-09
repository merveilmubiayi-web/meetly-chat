import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Path } from 'react-native-svg';

export default function PlusButtonIcon({
  size = 44,
  variant = 'gradient', // 'gradient' | 'outline' | 'tiktok'
  color = '#ffffff',
  style,
}) {
  if (variant === 'outline') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
        <Path
          d="M12 5v14M5 12h14"
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  // TikTok style 3-layer button or Meetly Gradient Plus
  const width = size;
  const height = Math.round(size * 0.68);
  const cornerRadius = Math.round(height * 0.3);

  if (variant === 'tiktok') {
    return (
      <View style={[{ width, height, justifyContent: 'center', alignItems: 'center' }, style]}>
        {/* Cyan backdrop */}
        <View
          style={[
            styles.tiktokLayer,
            {
              width: width - 8,
              height,
              borderRadius: cornerRadius,
              backgroundColor: '#00f2fe',
              transform: [{ translateX: -3 }],
            },
          ]}
        />
        {/* Red/Magenta backdrop */}
        <View
          style={[
            styles.tiktokLayer,
            {
              width: width - 8,
              height,
              borderRadius: cornerRadius,
              backgroundColor: '#fe2c55',
              transform: [{ translateX: 3 }],
            },
          ]}
        />
        {/* Center White badge */}
        <View
          style={[
            styles.tiktokCenter,
            {
              width: width - 12,
              height,
              borderRadius: cornerRadius,
              backgroundColor: '#ffffff',
            },
          ]}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path
              d="M12 5v14M5 12h14"
              stroke="#000000"
              strokeWidth={3}
              strokeLinecap="round"
            />
          </Svg>
        </View>
      </View>
    );
  }

  // Meetly Signature Gradient Plus Button
  return (
    <Svg width={size} height={size} viewBox="0 0 44 44" style={style}>
      <Defs>
        <LinearGradient id="meetlyPlusGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#a613c4" />
          <Stop offset="100%" stopColor="#f72585" />
        </LinearGradient>
      </Defs>
      <Rect
        x="2"
        y="2"
        width="40"
        height="40"
        rx="20"
        fill="url(#meetlyPlusGrad)"
      />
      <Path
        d="M22 13v18M13 22h18"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  tiktokLayer: {
    position: 'absolute',
  },
  tiktokCenter: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
});
