import {
    addDoc,
    arrayRemove,
    arrayUnion,
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    query,
    setDoc,
    updateDoc,
    where
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    Image,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SkeletonLoader from '../components/SkeletonLoader';
import { auth, db } from '../config/firebase';
import { useSafeBottomPadding } from '../utils/safeAreaHelpers';

export default function FriendsScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const currentUser = auth.currentUser;

  const updateUserLocalState = (userId, updates) => {
    setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, ...updates } : user)));
  };

  // Charge quelques membres par défaut à l'ouverture de la page
  useEffect(() => {
    fetchDefaultUsers();
  }, []);

  const fetchDefaultUsers = async () => {
    setLoading(true);
    try {
      const usersRef = collection(db, "users");
      // On limite à 10 utilisateurs max pour l'affichage de base
      const q = query(usersRef, limit(10)); 
      const querySnapshot = await getDocs(q);
      
      const uList = [];
      querySnapshot.forEach((doc) => {
        // On n'affiche pas l'utilisateur actuellement connecté dans la recherche
        if (doc.id !== currentUser?.uid) {
          uList.push({ id: doc.id, ...doc.data() });
        }
      });
      setUsers(uList);
    } catch (error) {
      console.error("Erreur utilisateurs par défaut :", error);
    } finally {
      setLoading(false);
    }
  };

  // Logique de recherche dynamique par nom ou username
  const handleSearch = async (text) => {
    setSearchQuery(text);
    if (text.trim() === '') {
      fetchDefaultUsers();
      return;
    }

    setLoading(true);
    try {
      const usersRef = collection(db, "users");
      // Recherche insensible à la casse ou exacte sur le username
      const q = query(
        usersRef, 
        where("username", ">=", text.toLowerCase()), 
        where("username", "<=", text.toLowerCase() + '\uf8ff')
      );
      
      const querySnapshot = await getDocs(q);
      const searchResults = [];
      querySnapshot.forEach((doc) => {
        if (doc.id !== currentUser?.uid) {
          searchResults.push({ id: doc.id, ...doc.data() });
        }
      });
      setUsers(searchResults);
    } catch (error) {
      console.error("Erreur recherche :", error);
    } finally {
      setLoading(false);
    }
  };

  // Algorithme d'initiation de conversation (Vérifie ou Crée un Chat unique)
  const handleStartChat = async (targetUser) => {
    if (!currentUser?.uid || !targetUser?.id) return;

    setLoading(true);
    try {
      const participantsArray = [currentUser.uid, targetUser.id].sort();
      const chatId = participantsArray.join('_');
      const chatRef = doc(db, 'chats', chatId);
      const existingChatSnap = await getDoc(chatRef);

      if (existingChatSnap.exists()) {
        navigation.push('ChatRoom', { chatId, recipientId: targetUser.id });
      } else {
        await setDoc(chatRef, {
          participants: participantsArray,
          lastMessage: `Discuter avec ${targetUser.displayName || 'cette personne'} ✨`,
          lastMessageSender: currentUser.uid,
          updatedAt: new Date()
        });

        navigation.push('ChatRoom', { chatId, recipientId: targetUser.id });
      }
    } catch (error) {
      console.error('Erreur initiation chat :', error);
      Alert.alert('Erreur', 'Impossible de démarrer la discussion.');
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async (targetUser) => {
    if (!currentUser?.uid) return;

    try {
      const currentUserRef = doc(db, 'users', currentUser.uid);
      const targetUserRef = doc(db, 'users', targetUser.id);

      const [currentUserDocSnap, targetUserDocSnap] = await Promise.all([
        getDoc(currentUserRef),
        getDoc(targetUserRef)
      ]);

      if (!currentUserDocSnap.exists() || !targetUserDocSnap.exists()) {
        Alert.alert('Erreur', 'Le profil utilisateur est introuvable.');
        return;
      }

      const currentUserData = currentUserDocSnap.data() || {};
      const targetUserData = targetUserDocSnap.data() || {};
      const isFollowing = (targetUserData.followers || []).includes(currentUser.uid);

      if (isFollowing) {
        const nextFollowers = (targetUserData.followers || []).filter((id) => id !== currentUser.uid);
        const nextFriends = (targetUserData.friends || []).filter((id) => id !== currentUser.uid);
        updateUserLocalState(targetUser.id, {
          followers: nextFollowers,
          friends: nextFriends,
          followersCount: Math.max((targetUserData.followersCount || 0) - 1, 0),
          friendsCount: Math.max((targetUserData.friendsCount || 0) - 1, 0)
        });

        await updateDoc(currentUserRef, {
          following: arrayRemove(targetUser.id),
          followingCount: Math.max((currentUserData.followingCount || 0) - 1, 0),
          friends: arrayRemove(targetUser.id),
          friendsCount: Math.max((currentUserData.friendsCount || 0) - 1, 0)
        });
        await updateDoc(targetUserRef, {
          followers: arrayRemove(currentUser.uid),
          followersCount: Math.max((targetUserData.followersCount || 0) - 1, 0),
          friends: arrayRemove(currentUser.uid),
          friendsCount: Math.max((targetUserData.friendsCount || 0) - 1, 0)
        });
      } else {
        const targetFollowsCurrentUser = (targetUserData.following || []).includes(currentUser.uid);
        const nextFollowers = [...(targetUserData.followers || []), currentUser.uid];
        const nextFriends = targetFollowsCurrentUser
          ? [...(targetUserData.friends || []), currentUser.uid]
          : (targetUserData.friends || []);

        updateUserLocalState(targetUser.id, {
          followers: nextFollowers,
          friends: nextFriends,
          followersCount: (targetUserData.followersCount || 0) + 1,
          friendsCount: targetFollowsCurrentUser ? (targetUserData.friendsCount || 0) + 1 : (targetUserData.friendsCount || 0)
        });

        await updateDoc(currentUserRef, {
          following: arrayUnion(targetUser.id),
          followingCount: (currentUserData.followingCount || 0) + 1,
          ...(targetFollowsCurrentUser ? {
            friends: arrayUnion(targetUser.id),
            friendsCount: (currentUserData.friendsCount || 0) + 1
          } : {})
        });
        await updateDoc(targetUserRef, {
          followers: arrayUnion(currentUser.uid),
          followersCount: (targetUserData.followersCount || 0) + 1,
          ...(targetFollowsCurrentUser ? {
            friends: arrayUnion(currentUser.uid),
            friendsCount: (targetUserData.friendsCount || 0) + 1
          } : {})
        });

        await addDoc(collection(db, 'notifications'), {
          recipientId: targetUser.id,
          title: 'Nouvel abonné',
          message: `${currentUserData.displayName || 'Quelqu’un'} vous a suivi.`,
          createdAt: new Date()
        });

        if (targetFollowsCurrentUser) {
          await addDoc(collection(db, 'notifications'), {
            recipientId: currentUser.uid,
            title: 'Retour d’abonnement',
            message: `${targetUserData.displayName || 'Quelqu’un'} vous suit en retour.`,
            createdAt: new Date()
          });
        }
      }
    } catch (error) {
      console.error('Erreur follow:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour le suivi.');
    }
  };

  const renderUserItem = ({ item }) => {
    const isFollowing = (item.followers || []).includes(currentUser?.uid);
    const isFriend = (item.friends || []).includes(currentUser?.uid);
    const buttonLabel = isFriend ? 'Ami' : isFollowing ? 'Abonné' : 'Suivre';

    return (
      <View style={styles.userCard}>
        <Image 
          source={{ uri: item.photoURL || 'https://via.placeholder.com/150' }} 
          style={styles.avatar} 
        />
        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.displayName}>{item.displayName}</Text>
            {item.isVerified && <Text style={styles.verifiedBadge}>⚡</Text>}
          </View>
          <Text style={styles.username}>{item.username}</Text>
          <Text style={styles.bio} numberOfLines={1}>{item.bio || "Pas de bio disponible"}</Text>
        </View>
        
        <View style={styles.actionsGroup}>
          <TouchableOpacity style={[styles.followButton, (isFollowing || isFriend) && styles.followButtonActive]} onPress={() => handleFollowToggle(item)}>
            <Text style={styles.followButtonText}>{buttonLabel}</Text>
          </TouchableOpacity>
          {isFriend && (
            <TouchableOpacity style={styles.messageButton} onPress={() => handleStartChat(item)}>
              <Text style={styles.messageButtonText}>Msg</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const bottomPadding = useSafeBottomPadding(20);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0c" />

      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>◁</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Amis</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Barre de recherche supérieure */}
      <View style={styles.searchHeader}>
        <TextInput 
          style={styles.searchInput}
          placeholder="Rechercher un membre par @username..."
          placeholderTextColor="#8a8a9a"
          value={searchQuery}
          onChangeText={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {loading && users.length === 0 ? (
        <View style={styles.centerLoading}>
          {[...Array(4)].map((_, index) => (
            <SkeletonLoader key={index} style={[styles.skeletonFriendRow, index > 0 && styles.skeletonRowMargin]} />
          ))}
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderUserItem}
          contentContainerStyle={[styles.listContainer, bottomPadding]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Aucun membre trouvé sous ce nom. 🔍</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  backButton: {
    padding: 4,
  },
  backIcon: {
    color: '#fff',
    fontSize: 20,
  },
  headerTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  searchHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  searchInput: {
    backgroundColor: '#141418',
    color: '#f0f0f2',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  skeletonFriendRow: { width: '94%', height: 90, borderRadius: 18, backgroundColor: '#141418', marginBottom: 14 },
  skeletonRowMargin: { marginTop: 12 },
  userCard: {
    flexDirection: 'row',
    backgroundColor: '#141418',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.02)',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0a0a0c',
  },
  userInfo: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  displayName: {
    color: '#f0f0f2',
    fontWeight: '700',
    fontSize: 15,
  },
  verifiedBadge: {
    color: '#a613c4',
    fontSize: 12,
    marginLeft: 4,
  },
  username: {
    color: '#8a8a9a',
    fontSize: 12,
    marginTop: 2,
  },
  bio: {
    color: '#4a4a5a',
    fontSize: 12,
    marginTop: 4,
  },
  actionsGroup: {
    alignItems: 'flex-end',
    gap: 6,
  },
  followButton: {
    backgroundColor: '#141418',
    borderWidth: 1,
    borderColor: '#a613c4',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  followButtonActive: {
    backgroundColor: '#a613c4',
  },
  followButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  messageButton: {
    backgroundColor: '#a613c4',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  messageButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    color: '#6a6a7a',
    fontSize: 14,
  },
});