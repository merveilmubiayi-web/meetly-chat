import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';

export default function SkeletonLoader({ style, children, speed = 900 }) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.75,
          duration: speed,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: speed,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [opacity, speed]);

  return (
    <Animated.View style={[styles.skeleton, style, { opacity }]}> 
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
