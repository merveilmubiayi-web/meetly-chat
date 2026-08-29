import { useEffect, useState } from 'react';
import {
    FlatList,
    Image,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import SkeletonLoader from '../components/SkeletonLoader';
import { supabase } from '../lib/supabase';

const formatChatTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return 'Hier';
  }
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
};

export default function ChatListScreen({ navigation }) {
  const [chats, setChats] = useState([]);
  const [userProfiles, setUserProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let active = true;
    const loadChats = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) { setLoading(false); return; }
      setCurrentUser(user);
      const { data: memberships, error: memberError } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', user.id);
      if (memberError) { setLoading(false); return; }
      const ids = (memberships || []).map((item) => item.conversation_id);
      if (!ids.length) { setChats([]); setLoading(false); return; }
      
      const [{ data: conversations, error }, { data: members }, { data: recentMessages }] = await Promise.all([
        supabase.from('conversations').select('*').in('id', ids).order('created_at', { ascending: false }),
        supabase.from('conversation_members').select('conversation_id, user_id').in('conversation_id', ids),
        supabase.from('messages').select('*').in('conversation_id', ids).order('created_at', { ascending: false }),
      ]);
      if (error || !active) { setLoading(false); return; }

      const profileIds = [...new Set((members || []).map((item) => item.user_id).filter((id) => id !== user.id))];
      const { data: profiles } = profileIds.length ? await supabase.from('profiles').select('*').in('id', profileIds) : { data: [] };
      const profileMap = Object.fromEntries((profiles || []).map((profile) => [profile.id, { ...profile, displayName: profile.name, photoURL: profile.avatar_url }]));
      setUserProfiles(profileMap);

      // Map last message per conversation
      const lastMsgMap = {};
      (recentMessages || []).forEach((msg) => {
        if (!lastMsgMap[msg.conversation_id]) {
          lastMsgMap[msg.conversation_id] = msg;
        }
      });

      setChats((conversations || []).map((conversation) => {
        const participants = (members || []).filter((item) => item.conversation_id === conversation.id).map((item) => item.user_id);
        const lastMsg = lastMsgMap[conversation.id];
        let lastMsgText = 'Aucun message';
        if (lastMsg) {
          if (lastMsg.media_type === 'audio') lastMsgText = 'Note vocale';
          else if (lastMsg.media_type === 'video') lastMsgText = 'Vidéo';
          else if (lastMsg.media_type === 'image') lastMsgText = 'Photo';
          else lastMsgText = lastMsg.body || 'Message';
        }
        return {
          ...conversation,
          participants,
          lastMessage: lastMsgText,
          lastMessageSender: lastMsg?.sender_id || null,
          updatedAt: lastMsg?.created_at || conversation.created_at,
        };
      }));
      setLoading(false);
    };
    loadChats();
    const unsubscribeFocus = navigation.addListener('focus', loadChats);
    const channel = supabase.channel('conversation-list').on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members' }, loadChats).on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, loadChats).on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, loadChats).subscribe();
    return () => { active = false; unsubscribeFocus(); supabase.removeChannel(channel); };
  }, [navigation]);

  const renderChatItem = ({ item }) => {
    const otherParticipantId = item.participants.find(id => id !== currentUser?.id);
    const recipient = userProfiles[otherParticipantId];
    const displayName = recipient?.displayName || `Membre #${otherParticipantId?.substring(0, 5) || 'user'}`;
    const avatarUri = recipient?.photoURL || 'https://via.placeholder.com/150/a613c4/ffffff?text=User';
    const timeText = formatChatTime(item.updatedAt);
    const isMe = item.lastMessageSender === currentUser?.id;

    return (
      <TouchableOpacity 
        style={styles.chatRow} 
        onPress={() => navigation.navigate('ChatRoom', { chatId: item.id, recipientId: otherParticipantId })}
      >
        <Image source={{ uri: avatarUri }} style={styles.avatar} />

        <View style={styles.chatInfo}>
          <View style={styles.chatHeaderRow}>
            <Text style={styles.username}>{displayName}</Text>
            <Text style={styles.time}>{timeText}</Text>
          </View>
          <Text style={[styles.lastMessage, isMe && styles.myLastMessage]} numberOfLines={1}>
            {isMe ? 'Vous : ' : ''}{item.lastMessage}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0c" />
      
      <View style={styles.header}>
        {/* 💡 Remplacement par router.back() */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>◁</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Discussions</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.centerLoading}>
          {[...Array(4)].map((_, index) => (
            <SkeletonLoader key={index} style={[styles.skeletonChatRow, index > 0 && styles.skeletonRowMargin]} />
          ))}
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          renderItem={renderChatItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60 + insets.bottom }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Aucune discussion pour le moment. ✨</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0c' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)' },
  backButton: { padding: 4 },
  backIcon: { fontSize: 20, color: '#fff' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', letterSpacing: 0.5 },
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  skeletonChatRow: { width: '92%', height: 88, borderRadius: 18, backgroundColor: '#141418', marginBottom: 16 },
  skeletonRowMargin: { marginTop: 12 },
  chatRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 1, borderColor: 'rgba(255, 255, 255, 0.02)' },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#141418' },
  chatInfo: { flex: 1, marginLeft: 14 },
  chatHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  username: { color: '#f0f0f2', fontWeight: '700', fontSize: 15 },
  time: { color: '#6a6a7a', fontSize: 12 },
  lastMessage: { color: '#8a8a9a', fontSize: 13 },
  myLastMessage: { color: '#c084fc' },
  emptyContainer: { flex: 1, alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#6a6a7a', fontSize: 14 },
});