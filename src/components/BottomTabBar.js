import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const tabs = [
  { key: 'HomeScreen', label: 'Accueil', icon: '🏠' },
  { key: 'FriendsScreen', label: 'Amis', icon: '👥' },
  { key: 'ChatListScreen', label: 'Message', icon: '💬' },
  { key: 'NotificationScreen', label: 'Notifs', icon: '🔔' },
];

export default function BottomTabBar({ navigation, activeTab, onPlusPress }) {
  const insets = useSafeAreaInsets();

  const renderTab = (key, label, icon, onPress) => {
    const isActive = activeTab === key;

    return (
      <TouchableOpacity
        key={key}
        style={[styles.tabItem, isActive && styles.tabItemActive]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>{icon}</Text>
        <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.bottomTabBar, { height: 64 + insets.bottom, paddingBottom: 10 + insets.bottom }]}> 
      {renderTab('HomeScreen', 'Accueil', '🏠', () => navigation.replace('HomeScreen'))}
      {renderTab('FriendsScreen', 'Amis', '👥', () => navigation.navigate('FriendsScreen'))}

      <TouchableOpacity style={styles.tabItemPlus} onPress={onPlusPress} activeOpacity={0.85}>
        <View style={styles.plusCircle}>
          <Text style={styles.plusIconText}>+</Text>
        </View>
      </TouchableOpacity>

      {renderTab('ChatListScreen', 'Message', '💬', () => navigation.navigate('ChatListScreen'))}
      {renderTab('NotificationScreen', 'Notifs', '🔔', () => navigation.navigate('NotificationScreen'))}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomTabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(10, 10, 12, 0.98)',
    alignSelf: 'stretch',
    width: '100%',
    zIndex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingBottom: 10,
    paddingTop: 8,
    height: 64,
    justifyContent: 'space-around',
    alignItems: 'center',
    boxShadow: '0px -4px 12px rgba(0, 0, 0, 0.3)',
    elevation: 10,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 48,
    borderRadius: 16,
    paddingHorizontal: 4,
  },
  tabItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  tabIcon: {
    fontSize: 24,
    color: 'rgba(255, 255, 255, 0.55)',
  },
  tabIconActive: {
    color: '#ffffff',
    textShadow: '0px 0px 6px rgba(255, 255, 255, 0.35)',
  },
  tabLabel: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  tabItemPlus: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#a613c4',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 4px 6px rgba(166, 19, 196, 0.3)',
    elevation: 5,
  },
  plusIconText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '600',
    marginTop: -2,
  },
});
