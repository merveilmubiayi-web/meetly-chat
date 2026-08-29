import { BlurView } from 'expo-blur';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function GlassIconButton({
  icon,
  label,
  active = false,
  onPress,
  onLongPress,
  accessibilityLabel,
  style,
}) {
  return (
    <TouchableOpacity
      accessibilityLabel={accessibilityLabel || label}
      accessibilityRole="button"
      activeOpacity={0.8}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.button, style]}
    >
      <BlurView intensity={active ? 42 : 28} tint="dark" style={styles.blur}>
        <View style={[styles.content, active && styles.contentActive]}>
          {typeof icon === 'string' ? <Text style={[styles.icon, active && styles.iconActive]}>{icon}</Text> : icon}
          {!!label && <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>}
        </View>
      </BlurView>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 58,
    height: 50,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  blur: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  contentActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  icon: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '500',
  },
  iconActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  label: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
  },
  labelActive: {
    color: '#ffffff',
  },
});
