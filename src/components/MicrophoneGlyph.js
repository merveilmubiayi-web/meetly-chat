import { StyleSheet, View } from 'react-native';

export default function MicrophoneGlyph({ color = '#ffffff' }) {
  return (
    <View style={styles.container}>
      <View style={[styles.mic, { borderColor: color }]} />
      <View style={[styles.arc, { borderColor: color }]} />
      <View style={[styles.stem, { backgroundColor: color }]} />
      <View style={[styles.base, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 21,
    height: 23,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  mic: {
    position: 'absolute',
    top: 0,
    width: 9,
    height: 14,
    borderWidth: 2,
    borderRadius: 6,
  },
  arc: {
    position: 'absolute',
    top: 8,
    width: 17,
    height: 11,
    borderWidth: 2,
    borderTopColor: 'transparent',
    borderRadius: 10,
  },
  stem: {
    position: 'absolute',
    bottom: 2,
    width: 2,
    height: 6,
  },
  base: {
    position: 'absolute',
    bottom: 0,
    width: 11,
    height: 2,
    borderRadius: 1,
  },
});
