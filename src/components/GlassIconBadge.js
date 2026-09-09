import { StyleSheet, Text, View } from 'react-native';

export default function GlassIconBadge({ icon, color = '#ffffff', size = 44, style }) {
  const palette = {
    background: '#141418',
    border: 'rgba(255, 255, 255, 0.08)',
  };

  return (
    <View style={[styles.wrapper, { width: size, height: size, borderRadius: size / 2, backgroundColor: palette.background, borderColor: palette.border }, style]}>
      <View style={styles.content}>
        {typeof icon === 'string' ? <Text style={[styles.icon, { color }]}>{icon}</Text> : icon}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    borderWidth: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 19,
    fontWeight: '700',
  },
});
