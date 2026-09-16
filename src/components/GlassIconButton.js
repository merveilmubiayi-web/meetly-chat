import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function GlassIconButton({
  icon,
  label,
  active = false,
  onPress,
  onLongPress,
  accessibilityLabel,
  badgeCount = 0,
  style,
}) {
  const palette = {
    background: 'rgba(20, 20, 24, 0.85)',
    border: 'rgba(255, 255, 255, 0.08)',
    activeBackground: 'rgba(166, 19, 196, 0.25)',
    activeBorder: '#a613c4',
    icon: '#c6c6ce',
    iconActive: '#ffffff',
    label: '#8a8a9a',
    labelActive: '#ffffff',
  };

  return (
    <TouchableOpacity
      accessibilityLabel={accessibilityLabel || label}
      accessibilityRole="button"
      activeOpacity={0.8}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        styles.button,
        { backgroundColor: palette.background, borderColor: palette.border },
        active && { backgroundColor: palette.activeBackground, borderColor: palette.activeBorder },
        style,
      ]}
    >
      <View style={styles.content}>
        {typeof icon === 'string' ? <Text style={[styles.icon, { color: active ? palette.iconActive : palette.icon }]}>{icon}</Text> : icon}
        {badgeCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text></View>}
        {!!label && <Text style={[styles.label, { color: active ? palette.labelActive : palette.label }]}>{label}</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 58,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '600',
  },
  label: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
  },
  badge: {
    position: 'absolute',
    top: 3,
    right: 3,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#ffffff', fontSize: 9, fontWeight: '800' },
});
