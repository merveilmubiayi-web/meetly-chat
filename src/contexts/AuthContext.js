import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);
const RECENT_ACCOUNTS_KEY = '@meetly/recent-accounts';

async function rememberAccount(user) {
  if (!user?.email) return;
  try {
    const stored = await AsyncStorage.getItem(RECENT_ACCOUNTS_KEY);
    const accounts = stored ? JSON.parse(stored) : [];
    const nextAccount = {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.email.split('@')[0],
      avatarUrl: user.user_metadata?.avatar_url || null,
    };
    const nextAccounts = [nextAccount, ...accounts.filter((account) => account.email !== user.email)].slice(0, 5);
    await AsyncStorage.setItem(RECENT_ACCOUNTS_KEY, JSON.stringify(nextAccounts));
  } catch (error) {
    console.warn('Recent accounts could not be saved:', error.message);
  }
}

async function ensureProfile(user) {
  if (!user) return null;
  const profile = {
    id: user.id,
    name: user.user_metadata?.name || user.email?.split('@')[0] || 'Meetly user',
    username: user.user_metadata?.username || null,
    phone_number: user.user_metadata?.phoneNumber || null,
    avatar_url: user.user_metadata?.avatar_url || null,
  };
  const { data, error } = await supabase.from('profiles').upsert(profile, { onConflict: 'id', ignoreDuplicates: true }).select().maybeSingle();
  if (error) throw error;
  return data || profile;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const applySession = async (nextSession) => {
      if (!mounted) return;
      setSession(nextSession || null);
      setUser(nextSession?.user || null);
      if (nextSession?.user) rememberAccount(nextSession.user);
      try {
        setProfile(nextSession?.user ? await ensureProfile(nextSession.user) : null);
      } catch (error) {
        console.warn('Profile initialization failed:', error.message);
        setProfile(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data }) => applySession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => applySession(nextSession));
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({
    session,
    user,
    profile,
    loading,
    isAuthenticated: Boolean(user),
    signOut: () => supabase.auth.signOut(),
    refreshProfile: async () => {
      if (!user) return null;
      const nextProfile = await ensureProfile(user);
      setProfile(nextProfile);
      return nextProfile;
    },
  }), [session, user, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
