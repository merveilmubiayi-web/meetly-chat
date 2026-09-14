import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import SkeletonLoader from '../components/SkeletonLoader';
import { getAvatarUri } from '../constants/assets';
import { useThemeStyles } from '../constants/themeStyles';
import { supabase } from '../lib/supabase';

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────
const TYPE_META = {
  like:    { emoji: '♥',  label: 'a aimé ta publication',    color: '#ef4444', screen: 'HomeScreen' },
  comment: { emoji: '💬', label: 'a commenté ta publication', color: '#3b82f6', screen: 'HomeScreen' },
  follow:  { emoji: '👤', label: 'a commencé à te suivre',    color: '#a855f7', screen: 'ProfileScreen' },
  message: { emoji: '✉️', label: 't\'a envoyé un message',    color: '#10b981', screen: 'ChatListScreen' },
  call:    { emoji: '📞', label: 'appel manqué',              color: '#f59e0b', screen: null },
};

const getTypeMeta = (type) => TYPE_META[type] || { emoji: '🔔', label: 'nouvelle activité', color: '#a613c4', screen: null };

const formatTime = (dateStr) => {
  if (!dateStr) return 'À l\'instant';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'À l\'instant';
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'À l\'instant';
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Il y a ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Il y a ${diffDays} j`;
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
};

// ──────────────────────────────────────────────────────────────
// Swipeable notification row
// ──────────────────────────────────────────────────────────────
function NotificationRow({ item, onPress, onDelete }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [revealed, setRevealed] = useState(false);
  const meta = getTypeMeta(item.type);

  const senderName = item.sender?.name || item.sender?.username || 'Quelqu\'un';
  const senderAvatar = getAvatarUri(item.sender?.avatar_url, senderName);
  const isUnread = !item.read_at;

  const revealDelete = () => {
    setRevealed(true);
    Animated.spring(translateX, { toValue: -70, useNativeDriver: true }).start();
  };

  const hideDelete = () => {
    setRevealed(false);
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
  };

  const handlePress = () => {
    if (revealed) { hideDelete(); return; }
    onPress(item);
  };

  return (
    <View style={styles.rowWrapper}>
      {/* Fond rouge delete */}
      <View style={styles.deleteBackground}>
        <TouchableOpacity style={styles.deleteButton} onPress={() => onDelete(item)}>
          <Text style={styles.deleteButtonText}>🗑</Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={{ transform: [{ translateX }] }}>
        <TouchableOpacity
          style={[styles.card, isUnread && styles.cardUnread]}
          onPress={handlePress}
          onLongPress={revealDelete}
          activeOpacity={0.85}
        >
          {/* Avatar */}
          <View style={styles.avatarWrapper}>
            <Image source={{ uri: senderAvatar }} style={styles.senderAvatar} />
            <View style={[styles.emojiDot, { backgroundColor: meta.color }]}>
              <Text style={styles.emojiDotText}>{meta.emoji}</Text>
            </View>
          </View>

          {/* Contenu */}
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text style={styles.senderName} numberOfLines={1}>
                <Text style={{ fontWeight: '800', color: '#f0f0f2' }}>{senderName} </Text>
                <Text style={{ color: '#b0b0bb', fontWeight: '400' }}>{meta.label}</Text>
              </Text>
              <Text style={styles.timeText}>{formatTime(item.created_at)}</Text>
            </View>
            {item.message ? (
              <Text style={styles.messageText} numberOfLines={2}>{item.message}</Text>
            ) : null}
          </View>

          {/* Point non lu */}
          {isUnread && <View style={styles.unreadDot} />}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────
// Main screen
// ──────────────────────────────────────────────────────────────
export default function NotificationScreen() {
  const themeStyles = useThemeStyles();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'

  // ─── Chargement ────────────────────────────────────────────
  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) { setLoading(false); return; }
      setCurrentUserId(user.id);

      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          sender:profiles!notifications_sender_id_fkey(id, name, username, avatar_url)
        `)
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(60);

      if (!active) return;
      if (error) {
        console.warn('Notifications Supabase:', error.message);
        // Fallback: essai sans jointure
        const { data: fallback } = await supabase
          .from('notifications')
          .select('*')
          .eq('recipient_id', user.id)
          .order('created_at', { ascending: false })
          .limit(60);
        setItems(fallback || []);
      } else {
        setItems(data || []);
      }
      setLoading(false);
    };

    load();

    // Abonnement Realtime filtré sur le recipient_id
    let channel = null;
    supabase.auth.getUser().then(({ data: u }) => {
      if (!u?.user || !active) return;
      channel = supabase
        .channel(`notifications-${u.user.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${u.user.id}`,
        }, async (payload) => {
          if (!active) return;
          // Récupérer le profil de l'expéditeur
          let sender = null;
          if (payload.new.sender_id) {
            const { data } = await supabase
              .from('profiles')
              .select('id, name, username, avatar_url')
              .eq('id', payload.new.sender_id)
              .maybeSingle();
            sender = data;
          }
          setItems((prev) => [{ ...payload.new, sender }, ...prev]);
        })
        .on('postgres_changes', {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${u.user.id}`,
        }, (payload) => {
          if (!active) return;
          setItems((prev) => prev.filter((n) => n.id !== payload.old.id));
        })
        .subscribe();
    });

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // ─── Actions ────────────────────────────────────────────────
  const markAsRead = async (item) => {
    if (!item.read_at) {
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read_at: now } : n)));
      await supabase
        .from('notifications')
        .update({ read_at: now })
        .eq('id', item.id);
    }
  };

  const markAllAsRead = async () => {
    if (!currentUserId) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => ({ ...n, read_at: now })));
    await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('recipient_id', currentUserId)
      .is('read_at', null);
  };

  const deleteNotification = async (item) => {
    Alert.alert('Supprimer', 'Supprimer cette notification ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          setItems((prev) => prev.filter((n) => n.id !== item.id));
          await supabase.from('notifications').delete().eq('id', item.id);
        },
      },
    ]);
  };

  const handleNotificationPress = async (item) => {
    await markAsRead(item);
    const meta = getTypeMeta(item.type);
    if (!meta.screen) return;

    switch (item.type) {
      case 'like':
      case 'comment':
        navigation.navigate('HomeScreen', { highlightPostId: item.post_id });
        break;
      case 'follow':
        if (item.sender_id) {
          navigation.navigate('ProfileScreen', { userId: item.sender_id });
        }
        break;
      case 'message':
        if (item.conversation_id) {
          navigation.navigate('ChatScreen', { chatId: item.conversation_id });
        } else {
          navigation.navigate('ChatListScreen');
        }
        break;
      default:
        break;
    }
  };

  // ─── Render ─────────────────────────────────────────────────
  const filteredItems = filter === 'unread' ? items.filter((n) => !n.read_at) : items;
  const unreadCount = items.filter((n) => !n.read_at).length;

  const renderItem = ({ item }) => (
    <NotificationRow
      item={item}
      onPress={handleNotificationPress}
      onDelete={deleteNotification}
    />
  );

  return (
    <SafeAreaView style={[styles.container, themeStyles.screen]}>
      <StatusBar barStyle={themeStyles.statusBar} backgroundColor="#0a0a0c" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>◁</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllAsRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Tout lire</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {/* Filtres pill */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterPill, filter === 'all' && styles.filterPillActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterPillText, filter === 'all' && styles.filterPillTextActive]}>
            Toutes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterPill, filter === 'unread' && styles.filterPillActive]}
          onPress={() => setFilter('unread')}
        >
          <Text style={[styles.filterPillText, filter === 'unread' && styles.filterPillTextActive]}>
            Non lues {unreadCount > 0 ? `(${unreadCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.skeletonList}>
          {[...Array(5)].map((_, i) => (
            <SkeletonLoader key={i} style={styles.skeletonCard} />
          ))}
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: 80 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyTitle}>
                {filter === 'unread' ? 'Tout est lu !' : 'Aucune notification'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {filter === 'unread'
                  ? 'Tu n\'as aucune notification non lue.'
                  : 'Les likes, commentaires et messages apparaîtront ici.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0c' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    backgroundColor: '#0a0a0c',
  },
  backBtn: { padding: 4, width: 36 },
  backIcon: { color: '#fff', fontSize: 20 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 4 },
  headerTitle: { color: '#fff', fontWeight: '800', fontSize: 18 },
  headerBadge: {
    backgroundColor: '#a613c4',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
    minWidth: 20,
    alignItems: 'center',
  },
  headerBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  markAllBtn: { paddingHorizontal: 4 },
  markAllText: { color: '#a613c4', fontSize: 13, fontWeight: '600' },

  // Filtres
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#141418',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  filterPillActive: { backgroundColor: '#a613c4', borderColor: '#a613c4' },
  filterPillText: { color: '#8a8a9a', fontSize: 13, fontWeight: '600' },
  filterPillTextActive: { color: '#fff' },

  // List
  list: { padding: 12 },

  // Row swipeable
  rowWrapper: { position: 'relative', marginBottom: 10, borderRadius: 16, overflow: 'hidden' },
  deleteBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  deleteButton: { paddingHorizontal: 20, justifyContent: 'center', height: '100%' },
  deleteButtonText: { fontSize: 20 },

  // Notification card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141418',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  cardUnread: {
    backgroundColor: '#1a1728',
    borderColor: 'rgba(166,19,196,0.25)',
  },

  // Avatar + emoji
  avatarWrapper: { position: 'relative', marginRight: 14, width: 46, height: 46 },
  senderAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#2a2a35',
    borderWidth: 2,
    borderColor: '#0a0a0c',
  },
  emojiDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#0a0a0c',
  },
  emojiDotText: { fontSize: 10 },

  // Content
  cardContent: { flex: 1 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 3,
    gap: 8,
  },
  senderName: { flex: 1, fontSize: 13, lineHeight: 18 },
  timeText: { color: '#6a6a7a', fontSize: 11, flexShrink: 0 },
  messageText: { color: '#9a9aaa', fontSize: 12, lineHeight: 17, marginTop: 2 },

  // Unread dot
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#a613c4',
    marginLeft: 10,
    flexShrink: 0,
  },

  // Empty
  emptyCard: { alignItems: 'center', justifyContent: 'center', marginTop: 80, paddingHorizontal: 30 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { color: '#8a8a9a', fontSize: 13, textAlign: 'center', lineHeight: 18 },

  // Skeleton
  skeletonList: { padding: 16 },
  skeletonCard: {
    width: '100%',
    height: 74,
    borderRadius: 16,
    backgroundColor: '#141418',
    marginBottom: 12,
  },
});
