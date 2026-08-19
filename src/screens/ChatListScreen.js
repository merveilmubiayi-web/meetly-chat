import { collection, doc, getDoc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
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
import { auth, db } from '../config/firebase';

export default function ChatListScreen({ navigation }) {
  const [chats, setChats] = useState([]);
  const [userProfiles, setUserProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const currentUser = auth.currentUser;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!currentUser) return;

    const chatsRef = collection(db, "chats");
    const q = query(
      chatsRef,
      where("participants", "array-contains", currentUser.uid),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatList = [];
      snapshot.forEach((docSnap) => {
        chatList.push({ id: docSnap.id, ...docSnap.data() });
      });
      setChats(chatList);

      const uniqueUserIds = [...new Set(chatList.flatMap((chat) => chat.participants.filter((id) => id !== currentUser.uid)))];
      const profiles = {};

      for (const userId of uniqueUserIds) {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          profiles[userId] = userDoc.data();
        }
      }

      setUserProfiles(profiles);
      setLoading(false);
    }, (error) => {
      console.error("Erreur lors de la récupération des discussions :", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const renderChatItem = ({ item }) => {
    const otherParticipantId = item.participants.find(id => id !== currentUser?.uid);
    const recipient = userProfiles[otherParticipantId];
    const displayName = recipient?.displayName || `Membre #${otherParticipantId?.substring(0, 5) || 'user'}`;
    const avatarUri = recipient?.photoURL || 'https://via.placeholder.com/150/a613c4/ffffff?text=User';
    const timeText = item.updatedAt?.seconds
      ? new Date(item.updatedAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'À l’instant';

    return (
      <TouchableOpacity 
        style={styles.chatRow} 
        onPress={() => navigation.navigate('ChatRoom', { chatId: item.id, recipientId: otherParticipantId })}
      >
        {/* 💡 Le commentaire doit être placé ICI, après la fermeture de la balise d'ouverture > */}
        <Image source={{ uri: avatarUri }} style={styles.avatar} />

        <View style={styles.chatInfo}>
          <View style={styles.chatHeaderRow}>
            <Text style={styles.username}>{displayName}</Text>
            <Text style={styles.time}>{timeText}</Text>
          </View>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessageSender === currentUser?.uid ? 'Vous : ' : ''}{item.lastMessage || 'Aucun message'}
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
  emptyContainer: { flex: 1, alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#6a6a7a', fontSize: 14 },
});