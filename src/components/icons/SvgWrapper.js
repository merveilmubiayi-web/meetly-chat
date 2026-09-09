import React from 'react';
import { Platform, View } from 'react-native';

let RNSvg = null;
try {
  RNSvg = require('react-native-svg');
} catch {
  // react-native-svg not installed or failed to load
}

export const Svg = (props) => {
  if (RNSvg?.default) {
    const Component = RNSvg.default;
    return <Component {...props} />;
  }
  if (RNSvg?.Svg) {
    const Component = RNSvg.Svg;
    return <Component {...props} />;
  }
  if (Platform.OS === 'web') {
    return <svg {...props} />;
  }
  return <View style={[{ width: props.width || 24, height: props.height || 24 }, props.style]}>{props.children}</View>;
};

export const Path = (props) => {
  if (RNSvg?.Path) {
    const Component = RNSvg.Path;
    return <Component {...props} />;
  }
  if (Platform.OS === 'web') {
    return <path {...props} />;
  }
  return null;
};

export const Circle = (props) => {
  if (RNSvg?.Circle) {
    const Component = RNSvg.Circle;
    return <Component {...props} />;
  }
  if (Platform.OS === 'web') {
    return <circle {...props} />;
  }
  return null;
};

export const Rect = (props) => {
  if (RNSvg?.Rect) {
    const Component = RNSvg.Rect;
    return <Component {...props} />;
  }
  if (Platform.OS === 'web') {
    return <rect {...props} />;
  }
  return null;
};

export const G = (props) => {
  if (RNSvg?.G) {
    const Component = RNSvg.G;
    return <Component {...props} />;
  }
  if (Platform.OS === 'web') {
    return <g {...props} />;
  }
  return null;
};

export const Defs = (props) => {
  if (RNSvg?.Defs) {
    const Component = RNSvg.Defs;
    return <Component {...props} />;
  }
  if (Platform.OS === 'web') {
    return <defs {...props} />;
  }
  return null;
};

export const LinearGradient = (props) => {
  if (RNSvg?.LinearGradient) {
    const Component = RNSvg.LinearGradient;
    return <Component {...props} />;
  }
  if (Platform.OS === 'web') {
    return <linearGradient {...props} />;
  }
  return null;
};

export const Stop = (props) => {
  if (RNSvg?.Stop) {
    const Component = RNSvg.Stop;
    return <Component {...props} />;
  }
  if (Platform.OS === 'web') {
    return <stop {...props} />;
  }
  return null;
};

export default {
  Svg,
  Path,
  Circle,
  Rect,
  G,
  Defs,
  LinearGradient,
  Stop,
};
