import { BlurView } from 'expo-blur';
import { StyleSheet, Text, View } from 'react-native';

export default function GlassIconBadge({ icon, color = '#ffffff', size = 44, style }) {
  return (
    <View style={[styles.wrapper, { width: size, height: size, borderRadius: size / 2 }, style]}>
      <BlurView intensity={32} tint="dark" style={[styles.blur, { borderRadius: size / 2 }]}>
        <View style={styles.content}>
          {typeof icon === 'string' ? <Text style={[styles.icon, { color }]}>{icon}</Text> : icon}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  blur: {
    flex: 1,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  icon: {
    fontSize: 19,
    fontWeight: '700',
  },
});
