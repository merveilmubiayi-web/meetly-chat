import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SkeletonLoader from '../components/SkeletonLoader';
import { getAvatarUri } from '../constants/assets';
import { supabase } from '../lib/supabase';
import { useSafeBottomPadding } from '../utils/safeAreaHelpers';
import { usePresence } from '../utils/presenceManager';
import {
  BackIcon,
  SearchIcon,
  UserPlusIcon,
  UserCheckIcon,
  MessagesIcon,
  VerifiedIcon,
} from '../components/icons';

const PAGE_SIZE = 10;

export default function FriendsScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [pageCursor, setPageCursor] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const pageCursorRef = useRef(null);

  const updateUserLocalState = (userId, updates) => {
    setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, ...updates } : user)));
  };

  const mapProfile = useCallback((profile, followingIds = [], viewerId = currentUser?.id) => ({
    ...profile,
    id: profile.id,
    displayName: profile.name,
    photoURL: profile.avatar_url,
    isVerified: profile.is_verified,
    followers: followingIds.includes(profile.id) ? [viewerId] : [],
  }), [currentUser?.id]);

  const fetchUsers = useCallback(async ({ userId = currentUser?.id, query = '', reset = true } = {}) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    try {
      let profilesQuery = supabase
        .from('profiles')
        .select('*')
        .neq('id', userId || '')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(PAGE_SIZE + 1);

      if (query.trim()) {
        const escapedQuery = query.trim().replace(/[%_,]/g, '');
        profilesQuery = profilesQuery.or(`username.ilike.%${escapedQuery}%,name.ilike.%${escapedQuery}%`);
      }

      const cursor = reset ? null : pageCursorRef.current;
      if (cursor) {
        profilesQuery = profilesQuery.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
      }

      const [{ data: profiles, error: profileError }, { data: follows, error: followError }] = await Promise.all([
        profilesQuery,
        userId ? supabase.from('follows').select('following_id').eq('follower_id', userId) : Promise.resolve({ data: [], error: null }),
      ]);
      if (profileError || followError) throw profileError || followError;
      const followingIds = (follows || []).map((follow) => follow.following_id);
      const page = profiles || [];
      const nextUsers = page.slice(0, PAGE_SIZE).map((profile) => mapProfile(profile, followingIds, userId));
      setUsers((previous) => reset ? nextUsers : [...previous, ...nextUsers]);
      setHasMore(page.length > PAGE_SIZE);
      const nextCursor = page.length > PAGE_SIZE ? page[PAGE_SIZE - 1] : page[page.length - 1] || null;
      pageCursorRef.current = nextCursor;
      setPageCursor(nextCursor);
    } catch (error) {
      console.error("Erreur utilisateurs par défaut :", error);
    } finally {
      if (reset) setLoading(false);
      else setLoadingMore(false);
    }
  }, [currentUser?.id, mapProfile]);

  const fetchDefaultUsers = useCallback((userId = currentUser?.id) => {
    pageCursorRef.current = null;
    setPageCursor(null);
    setHasMore(true);
    return fetchUsers({ userId, reset: true });
  }, [currentUser?.id, fetchUsers]);

  // Charge quelques membres par défaut à l'ouverture de la page
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data.user || null);
      fetchDefaultUsers(data.user?.id);
    });
    const unsubscribeFocus = navigation.addListener('focus', () => fetchDefaultUsers());
    return unsubscribeFocus;
  }, [fetchDefaultUsers, navigation]);

  // Logique de recherche dynamique par nom ou username
  const handleSearch = async (text) => {
    setSearchQuery(text);
    setPageCursor(null);
    setHasMore(true);
    fetchUsers({ query: text, reset: true });
  };

  const handleLoadMore = () => {
    if (!loading && !loadingMore && hasMore && pageCursor) {
      fetchUsers({ query: searchQuery, reset: false });
    }
  };

  // Algorithme d'initiation de conversation (Vérifie ou Crée un Chat unique)
  const handleStartChat = async (targetUser) => {
    if (!currentUser?.id || !targetUser?.id) return;

    setLoading(true);
    try {
      const { data: existingMembers } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', currentUser.id);
      const candidateIds = (existingMembers || []).map((item) => item.conversation_id);
      let conversationId = null;
      if (candidateIds.length) {
        const { data: shared } = await supabase.from('conversation_members').select('conversation_id').in('conversation_id', candidateIds).eq('user_id', targetUser.id).limit(1).maybeSingle();
        conversationId = shared?.conversation_id || null;
      }
      if (!conversationId) {
        const { data: conversation, error: conversationError } = await supabase
          .from('conversations')
          .insert({ created_by: currentUser.id, is_group: false })
          .select('id')
          .single();
        if (conversationError) throw conversationError;
        conversationId = conversation?.id;
        if (!conversationId) throw new Error('Identifiant de conversation manquant');

        const { error: memberError } = await supabase.from('conversation_members').insert([
          { conversation_id: conversationId, user_id: currentUser.id, role: 'admin' },
          { conversation_id: conversationId, user_id: targetUser.id, role: 'member' },
        ]);
        if (memberError) throw memberError;
      }
      navigation.push('ChatRoom', { chatId: conversationId, recipientId: targetUser.id });
    } catch (error) {
      console.error('Erreur initiation chat :', error);
      Alert.alert('Erreur', error.message || 'Impossible de démarrer la discussion.');
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async (targetUser) => {
    if (!currentUser?.id) return;

    try {
      const { data: existing, error: existingError } = await supabase.from('follows').select('follower_id').eq('follower_id', currentUser.id).eq('following_id', targetUser.id).maybeSingle();
      if (existingError) throw existingError;
      if (existing) {
        const { error } = await supabase.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', targetUser.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('follows').insert({ follower_id: currentUser.id, following_id: targetUser.id });
        if (error) throw error;
      }
      updateUserLocalState(targetUser.id, { followers: existing ? [] : [currentUser.id] });
    } catch (error) {
      console.error('Erreur follow:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour le suivi.');
    }
  };

  const renderUserItem = ({ item }) => {
    const isFollowing = (item.followers || []).includes(currentUser?.id);
    const buttonLabel = isFollowing ? 'Abonné' : 'Suivre';

    return (
      <View style={styles.userCard}>
        <Image
          source={{ uri: getAvatarUri(item.photoURL, item.displayName) }}
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
          <TouchableOpacity style={[styles.followButton, isFollowing && styles.followButtonActive]} onPress={() => handleFollowToggle(item)}>
            <Text style={styles.followButtonText}>{buttonLabel}</Text>
          </TouchableOpacity>
          {isFollowing && (
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
          <BackIcon size={20} color="#ffffff" />
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
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
          style={styles.list}
          contentContainerStyle={[styles.listContainer, bottomPadding]}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator color="#a613c4" style={styles.listFooter} /> : null}
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
  list: {
    flex: 1,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  listFooter: {
    paddingVertical: 12,
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