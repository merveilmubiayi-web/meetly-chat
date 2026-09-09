import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GlassIconButton from './GlassIconButton';
import {
  HomeIcon,
  FriendsIcon,
  PlusButtonIcon,
  MessagesIcon,
  BellIcon,
} from './icons';

export default function BottomTabBar({ navigation, activeTab, onPlusPress, unreadMessages = 0, unreadNotifs = 0 }) {
  const insets = useSafeAreaInsets();

  const renderTab = (key, label, IconComponent, onPress, badgeCount = 0) => {
    const isActive = activeTab === key;

    return (
      <GlassIconButton
        key={key}
        icon={<IconComponent size={22} color={isActive ? '#ffffff' : '#8a8a9a'} filled={isActive} />}
        label={label}
        active={isActive}
        onPress={onPress}
      />
    );
  };

  return (
    <View style={[
      styles.bottomTabBar,
      {
        height: 64 + insets.bottom,
        paddingBottom: 10 + insets.bottom,
        backgroundColor: '#0a0a0c',
        borderColor: 'rgba(255, 255, 255, 0.08)',
      }
    ]}> 
      {renderTab('HomeScreen', 'Accueil', HomeIcon, () => navigation.replace('HomeScreen'))}
      {renderTab('FriendsScreen', 'Amis', FriendsIcon, () => navigation.navigate('FriendsScreen'))}

      <TouchableOpacity style={styles.tabItemPlus} onPress={onPlusPress} activeOpacity={0.85}>
        <PlusButtonIcon size={42} variant="gradient" />
      </TouchableOpacity>

      {renderTab('ChatListScreen', 'Message', MessagesIcon, () => navigation.navigate('ChatListScreen'), unreadMessages)}
      {renderTab('NotificationScreen', 'Notifs', BellIcon, () => navigation.navigate('NotificationScreen'), unreadNotifs)}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomTabBar: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    width: '100%',
    zIndex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingBottom: 10,
    paddingTop: 8,
    height: 64,
    justifyContent: 'space-around',
    alignItems: 'center',
    elevation: 10,
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
