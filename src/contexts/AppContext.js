import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { presenceManager } from '../utils/presenceManager';
import { useAuth } from './AuthContext';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const { user } = useAuth();
  const [presenceMap, setPresenceMap] = useState(() => presenceManager.getPresenceMap());
  const [unreadCounts, setUnreadCounts] = useState({ messages: 0, notifications: 0 });

  const refreshUnreadCounts = async () => {
    if (!user) {
      setUnreadCounts({ messages: 0, notifications: 0 });
      return;
    }
    const [{ count: notifications }, { count: messages }] = await Promise.all([
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', user.id).is('read_at', null),
      supabase.from('messages').select('id', { count: 'exact', head: true }).eq('recipient_id', user.id).is('read_at', null),
    ]);
    setUnreadCounts({ messages: messages || 0, notifications: notifications || 0 });
  };

  useEffect(() => presenceManager.subscribe(setPresenceMap), []);

  useEffect(() => {
    let active = true;
    let notificationChannel;
    let messageChannel;

    const loadCounts = async () => {
      if (!user) {
        if (active) setUnreadCounts({ messages: 0, notifications: 0 });
        return;
      }
      const [{ count: notifications }, { count: messages }] = await Promise.all([
        supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', user.id).is('read_at', null),
        supabase.from('messages').select('id', { count: 'exact', head: true }).eq('recipient_id', user.id).is('read_at', null),
      ]);
      if (active) setUnreadCounts({ messages: messages || 0, notifications: notifications || 0 });
    };

    loadCounts();
    if (user) {
      notificationChannel = supabase.channel(`app-notifications-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` }, loadCounts).subscribe();
      messageChannel = supabase.channel(`app-messages-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `recipient_id=eq.${user.id}` }, loadCounts).subscribe();
    }
    return () => {
      active = false;
      if (notificationChannel) supabase.removeChannel(notificationChannel).catch(() => {});
      if (messageChannel) supabase.removeChannel(messageChannel).catch(() => {});
    };
  }, [user?.id]);

  const value = useMemo(() => ({ currentUser: user, presenceMap, unreadCounts, refreshUnreadCounts }), [presenceMap, unreadCounts, user]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}
