import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function Badge({
  count,
  dot = false,
  maxCount = 99,
  backgroundColor = '#fe2c55',
  textColor = '#ffffff',
  size = 18,
  style,
  textStyle,
}) {
  if (!dot && (count === undefined || count === null || count <= 0)) {
    return null;
  }

  if (dot) {
    return (
      <View
        style={[
          styles.dot,
          {
            backgroundColor,
            width: size * 0.45,
            height: size * 0.45,
            borderRadius: (size * 0.45) / 2,
          },
          style,
        ]}
      />
    );
  }

  const displayCount = typeof count === 'number' && count > maxCount ? `${maxCount}+` : String(count);

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor,
          minWidth: size,
          height: size,
          borderRadius: size / 2,
          paddingHorizontal: displayCount.length > 1 ? 5 : 0,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: textColor,
            fontSize: displayCount.length > 2 ? 9 : 11,
          },
          textStyle,
        ]}
        numberOfLines={1}
      >
        {displayCount}
      </Text>
    </View>
  );
}

export function BadgeWrapper({
  children,
  count,
  dot = false,
  maxCount = 99,
  badgePosition = 'top-right',
  badgeProps,
  style,
}) {
  const hasBadge = dot || (count !== undefined && count !== null && count > 0) || (badgeProps && (badgeProps.dot || badgeProps.count > 0));

  return (
    <View style={[styles.wrapper, style]}>
      {children}
      {hasBadge && (
        <View style={[styles.badgeAbsolute, styles[badgePosition] || styles['top-right']]}>
          <Badge count={count} dot={dot} maxCount={maxCount} {...badgeProps} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#0a0a0c',
  },
  dot: {
    borderWidth: 1,
    borderColor: '#0a0a0c',
  },
  text: {
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 12,
  },
  badgeAbsolute: {
    position: 'absolute',
    zIndex: 10,
  },
  'top-right': {
    top: -4,
    right: -6,
  },
  'top-left': {
    top: -4,
    left: -6,
  },
  'bottom-right': {
    bottom: -4,
    right: -6,
  },
});
