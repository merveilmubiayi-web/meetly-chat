import { useEffect, useState } from 'react';
import { FlatList, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import GlassIconBadge from '../components/GlassIconBadge';
import CommentGlyph from '../components/CommentGlyph';
import SkeletonLoader from '../components/SkeletonLoader';
import { supabase } from '../lib/supabase';

const getNotificationDetails = (type) => {
  switch (type) {
    case 'like':
      return { icon: '♥', label: 'Mention J’aime', color: '#ef4444' };
    case 'comment':
      return { icon: <CommentGlyph color="#3b82f6" />, label: 'Nouveau commentaire', color: '#3b82f6' };
    case 'follow':
      return { icon: '○', label: 'Nouvel abonné', color: '#a855f7' };
    case 'message':
      return { icon: '□', label: 'Nouveau message', color: '#10b981' };
    case 'call':
      return { icon: '◉', label: 'Appel manqué', color: '#f59e0b' };
    default:
      return { icon: '🔔', label: 'Notification', color: '#a613c4' };
  }
};

const formatNotificationTime = (dateStr) => {
  if (!dateStr) return 'À l’instant';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'À l’instant';
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'À l’instant';
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Il y a ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Il y a ${diffDays} j`;
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
};

export default function NotificationScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let active = true;
    const loadNotifications = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) { setLoading(false); return; }
      setCurrentUserId(user.id);

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false });

      if (!active) return;
      if (error) console.warn('Notifications Supabase failed:', error.message);
      setItems(data || []);
      setLoading(false);
    };
    loadNotifications();
    const channel = supabase.channel('notifications-feed').on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, loadNotifications).subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, []);

  const markAsRead = async (item) => {
    if (!item.read_at) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n)));
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', item.id);
    }
  };

  const markAllAsRead = async () => {
    if (!currentUserId) return;
    setItems((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })));
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', currentUserId).is('read_at', null);
  };

  const renderNotificationItem = ({ item }) => {
    const details = getNotificationDetails(item.type);
    const isUnread = !item.read_at;

    return (
      <TouchableOpacity
        style={[styles.card, isUnread && styles.cardUnread]}
        onPress={() => markAsRead(item)}
        activeOpacity={0.8}
      >
        <GlassIconBadge icon={details.icon} color={details.color} style={styles.iconContainer} />

        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={[styles.title, { color: details.color }]}>{details.label}</Text>
            <Text style={styles.time}>{formatNotificationTime(item.created_at)}</Text>
          </View>
          <Text style={styles.messageText}>{item.message}</Text>
        </View>

        {isUnread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0c" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>◁</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {items.some((n) => !n.read_at) ? (
          <TouchableOpacity onPress={markAllAsRead}>
            <Text style={styles.markAllText}>Tout lire</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {loading ? (
        <View style={styles.centerLoading}>
          <SkeletonLoader style={styles.skeletonCard} />
          <SkeletonLoader style={[styles.skeletonCard, styles.skeletonCardSpacer]} />
          <SkeletonLoader style={[styles.skeletonCard, styles.skeletonCardSpacer]} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderNotificationItem}
          contentContainerStyle={[styles.list, { paddingBottom: 80 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <GlassIconBadge icon="🔔" color="#a613c4" size={56} style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>Aucune notification</Text>
              <Text style={styles.emptySubtitle}>Les nouvelles activités (likes, commentaires, messages) apparaîtront ici.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0c' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  backBtn: { padding: 4 },
  backIcon: { color: '#fff', fontSize: 20 },
  headerTitle: { color: '#fff', fontWeight: '700', fontSize: 18 },
  markAllText: { color: '#a613c4', fontSize: 13, fontWeight: '600' },
  list: { padding: 16 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#141418', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)' },
  cardUnread: { backgroundColor: '#1a1824', borderColor: 'rgba(166, 19, 196, 0.3)' },
  iconContainer: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  typeIcon: { fontSize: 20 },
  cardContent: { flex: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontWeight: '700', fontSize: 14 },
  time: { color: '#6a6a7a', fontSize: 11 },
  messageText: { color: '#f0f0f2', fontSize: 13, lineHeight: 18 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#a613c4', marginLeft: 8 },
  emptyCard: { alignItems: 'center', justifyContent: 'center', marginTop: 80, paddingHorizontal: 30 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { color: '#8a8a9a', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  skeletonCard: {
    width: '90%',
    height: 80,
    borderRadius: 18,
    backgroundColor: '#141418',
    marginBottom: 14,
    alignSelf: 'center',
  },
  skeletonCardSpacer: {
    marginTop: 6,
  },
});
