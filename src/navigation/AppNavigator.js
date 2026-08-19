import { createNavigationContainerRef, NavigationContainer, StackActions } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import BottomTabBar from '../components/BottomTabBar';
import { supabase } from '../lib/supabase';

import AccountSettingsScreen from '../screens/AccountSettingsScreen';
import BlockedUsersScreen from '../screens/BlockedUsersScreen';
import CertificationsScreen from '../screens/CertificationsScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ChatScreen from '../screens/ChatScreen';
import FriendsScreen from '../screens/FriendsScreen';
import HelpScreen from '../screens/HelpScreen';
import HomeScreen from '../screens/HomeScreen';
import LiveCallScreen from '../screens/LiveCallScreen';
import LoginScreen from '../screens/LoginScreen';
import NotificationScreen from '../screens/NotificationScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ProfileVisibilityScreen from '../screens/ProfileVisibilityScreen';
import RegisterScreen from '../screens/RegisterScreen';
import SavedPostsScreen from '../screens/SavedPostsScreen';
import SearchResultsScreen from '../screens/SearchResultsScreen';
import StudioPostScreen from '../screens/StudioPostScreen';
import TikTokScreen from '../screens/TikTokScreen';

const Stack = createStackNavigator();

export default function AppNavigator() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setUser(data.session?.user || null);
        setLoading(false);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setLoading(false);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const navigationRef = createNavigationContainerRef();
  const [currentRoute, setCurrentRoute] = useState('HomeScreen');

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        const r = navigationRef.getCurrentRoute();
        setCurrentRoute(r?.name ?? 'HomeScreen');
      }}
      onStateChange={() => {
        const r = navigationRef.getCurrentRoute();
        setCurrentRoute(r?.name ?? 'HomeScreen');
      }}
    >
      <View style={styles.appShell}>
        <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={user ? 'HomeScreen' : 'LoginScreen'}>
          <Stack.Screen name="LoginScreen" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="HomeScreen" component={HomeScreen} />
          <Stack.Screen name="ProfileScreen" component={ProfileScreen} />
          <Stack.Screen name="AccountSettingsScreen" component={AccountSettingsScreen} />
          <Stack.Screen name="FriendsScreen" component={FriendsScreen} />
          <Stack.Screen name="ChatListScreen" component={ChatListScreen} />
          <Stack.Screen name="ChatRoom" component={ChatScreen} />
          <Stack.Screen name="StudioPostScreen" component={StudioPostScreen} />
          <Stack.Screen name="LiveCallScreen" component={LiveCallScreen} />
          <Stack.Screen name="TikTokScreen" component={TikTokScreen} />
          <Stack.Screen name="NotificationScreen" component={NotificationScreen} />
          <Stack.Screen name="HelpScreen" component={HelpScreen} />
          <Stack.Screen name="SavedPosts" component={SavedPostsScreen} />
          <Stack.Screen name="SearchResults" component={SearchResultsScreen} />
          <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
          <Stack.Screen name="ProfileVisibility" component={ProfileVisibilityScreen} />
          <Stack.Screen name="Certifications" component={CertificationsScreen} />
        </Stack.Navigator>

        {user && ['HomeScreen', 'ChatListScreen', 'NotificationScreen', 'ProfileScreen'].includes(currentRoute) && (
          <BottomTabBar
            navigation={{
              navigate: (name, params) => navigationRef.current?.navigate(name, params),
              replace: (name, params) => navigationRef.current?.dispatch(StackActions.replace(name, params)),
            }}
            activeTab={currentRoute}
            onPlusPress={() => navigationRef.current?.navigate('StudioPostScreen')}
          />
        )}
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0c',
    paddingHorizontal: 24,
  },
  welcomeLogo: {
    width: 96,
    height: 96,
    marginBottom: 20,
    resizeMode: 'contain',
  },
  welcomeTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    color: '#8a8a9a',
    fontSize: 15,
    textAlign: 'center',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0c',
  },
  appShell: {
    flex: 1,
    position: 'relative',
  },
  previewHeader: {
    width: '86%',
    height: 22,
    borderRadius: 999,
    backgroundColor: '#141418',
    marginBottom: 18,
  },
  previewRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  previewCardLarge: {
    width: '65%',
    height: 180,
    borderRadius: 20,
    backgroundColor: '#141418',
  },
  previewCardSmall: {
    width: '30%',
    height: 180,
    borderRadius: 20,
    backgroundColor: '#141418',
  },
  previewContent: {
    width: '100%',
    flexDirection: 'column',
  },
  previewLine: {
    height: 16,
    borderRadius: 12,
    backgroundColor: '#141418',
    width: '100%',
    marginBottom: 12,
  },
  previewLineLong: {
    width: '100%',
  },
  previewLineShort: {
    width: '60%',
  },
});