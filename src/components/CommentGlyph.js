import { StyleSheet, View } from 'react-native';

export default function CommentGlyph({ color = '#ffffff' }) {
  return (
    <View style={styles.container}>
      <View style={[styles.bubble, { borderColor: color }]} />
      <View style={[styles.tail, { borderTopColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 21,
    height: 21,
    justifyContent: 'center',
  },
  bubble: {
    width: 19,
    height: 14,
    borderWidth: 2,
    borderRadius: 6,
  },
  tail: {
    position: 'absolute',
    left: 3,
    bottom: 1,
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderTopColor: '#ffffff',
    borderRightWidth: 5,
    borderRightColor: 'transparent',
  },
});
