import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SkeletonLoader from '../components/SkeletonLoader';
import { supabase } from '../lib/supabase';
import { useSafeBottomPadding } from '../utils/safeAreaHelpers';

export default function SearchResultsScreen({ navigation, route }) {
  const initialSearch = route?.params?.query || '';
  const [searchText, setSearchText] = useState(initialSearch);
  const [filter, setFilter] = useState('top');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [followingIds, setFollowingIds] = useState([]);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  useEffect(() => {
    const loadCurrentUser = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user || null;
      setCurrentUser(user);
      if (!user) return;
      const { data: follows } = await supabase.from('follows').select('following_id').eq('follower_id', user.id);
      setFollowingIds((follows || []).map((follow) => follow.following_id));
    };
    loadCurrentUser();
  }, []);

  useEffect(() => {
    let active = true;
    const loadPosts = async () => {
      const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
      if (!active) return;
      if (error) console.warn('Search posts failed:', error.message);
      setPosts((data || []).map((post) => ({
        ...post,
        authorId: post.author_id,
        authorName: post.author_name,
        authorAvatar: post.author_avatar,
        mediaUrl: post.media_url,
        createdAt: post.created_at,
      })));
      setLoading(false);
    };
    loadPosts();
    const channel = supabase.channel('search-posts').on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, loadPosts).subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, []);

  const normalizedQuery = (searchText || '').trim().toLowerCase();

  const results = useMemo(() => {
    if (!normalizedQuery) return [];

    const people = posts
      .filter((post) => (post.authorName || '').toLowerCase().includes(normalizedQuery))
      .map((post) => ({
        id: `person_${post.authorId || post.id}`,
        personId: post.authorId,
        type: 'person',
        name: post.authorName || 'Utilisateur',
        avatar: post.authorAvatar,
        subtitle: 'Publication récente',
      }));

    const hashtags = Array.from(
      new Set(
        posts.flatMap((post) => {
          const matches = (post.caption || '').match(/#\w+/g) || [];
          return matches.filter((tag) => tag.toLowerCase().includes(normalizedQuery.replace(/^#/, '')));
        })
      )
    ).map((tag) => ({ id: `tag_${tag}`, type: 'hashtag', name: tag, subtitle: 'Hashtag' }));

    const postsMatching = posts.filter((post) => {
      const caption = (post.caption || '').toLowerCase();
      const author = (post.authorName || '').toLowerCase();
      const tags = (post.caption || '').match(/#\w+/g) || [];
      const matchesTag = tags.some((tag) => tag.toLowerCase().includes(normalizedQuery.replace(/^#/, '')));
      return caption.includes(normalizedQuery) || author.includes(normalizedQuery) || matchesTag;
    });

    const videoResults = postsMatching.filter((post) => post.type === 'video');

    return { people, hashtags, posts: postsMatching, videoResults };
  }, [normalizedQuery, posts]);

  const filteredResults = (() => {
    if (!normalizedQuery) return [];
    switch (filter) {
      case 'video':
        return results.videoResults;
      case 'people':
        return results.people;
      case 'hashtag':
        return results.hashtags;
      default:
        return [
          ...results.people.slice(0, 3),
          ...results.hashtags.slice(0, 3),
          ...results.videoResults.slice(0, 4),
          ...results.posts.slice(0, 6),
        ];
    }
  })();

  const toggleFollow = async (targetUserId) => {
    if (!currentUser?.id || !targetUserId || targetUserId === currentUser.id) return;
    const isFollowing = followingIds.includes(targetUserId);
    setActionLoadingId(targetUserId);
    try {
      const result = isFollowing
        ? await supabase.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', targetUserId)
        : await supabase.from('follows').insert({ follower_id: currentUser.id, following_id: targetUserId });
      if (result.error) throw result.error;
      setFollowingIds((ids) => isFollowing ? ids.filter((id) => id !== targetUserId) : [...ids, targetUserId]);
    } catch (error) {
      console.error('Erreur abonnement:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour l’abonnement.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const startChat = async (targetUserId) => {
    if (!currentUser?.id || !targetUserId || targetUserId === currentUser.id) return;
    setActionLoadingId(targetUserId);
    try {
      const { data: ownMemberships, error: ownMembershipError } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', currentUser.id);
      if (ownMembershipError) throw ownMembershipError;
      const candidateIds = (ownMemberships || []).map((item) => item.conversation_id);
      let conversationId = null;
      if (candidateIds.length) {
        const { data: shared, error: sharedError } = await supabase.from('conversation_members').select('conversation_id').in('conversation_id', candidateIds).eq('user_id', targetUserId).limit(1).maybeSingle();
        if (sharedError) throw sharedError;
        conversationId = shared?.conversation_id || null;
      }
      if (!conversationId) {
        const { data: conversation, error: conversationError } = await supabase.from('conversations').insert({ created_by: currentUser.id, is_group: false }).select().single();
        if (conversationError) throw conversationError;
        conversationId = conversation.id;
        const { error: membersError } = await supabase.from('conversation_members').insert([
          { conversation_id: conversationId, user_id: currentUser.id, role: 'admin' },
          { conversation_id: conversationId, user_id: targetUserId, role: 'member' },
        ]);
        if (membersError) throw membersError;
      }
      navigation.navigate('ChatRoom', { chatId: conversationId, recipientId: targetUserId });
    } catch (error) {
      console.error('Erreur démarrage discussion:', error);
      Alert.alert('Erreur', 'Impossible de démarrer la discussion.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const renderItem = ({ item }) => {
    if (item.type === 'person') {
      const isFollowing = followingIds.includes(item.personId);
      const isCurrentUser = item.personId === currentUser?.id;
      const isActionLoading = actionLoadingId === item.personId;
      return (
        <View style={styles.resultRow}>
          <TouchableOpacity style={styles.personIdentity} onPress={() => navigation.navigate('ProfileScreen', { userId: item.personId })}>
            <Image source={{ uri: item.avatar || 'https://via.placeholder.com/150' }} style={styles.avatar} />
            <View style={styles.resultInfo}>
              <Text style={styles.resultTitle}>{item.name}</Text>
              <Text style={styles.resultSubtitle}>{item.subtitle}</Text>
            </View>
          </TouchableOpacity>
          {!isCurrentUser ? (
            <View style={styles.actionsGroup}>
              <TouchableOpacity style={[styles.actionButton, isFollowing && styles.actionButtonSecondary]} onPress={() => toggleFollow(item.personId)} disabled={isActionLoading}>
                <Text style={styles.actionText}>{isActionLoading ? '...' : isFollowing ? 'Abonné' : 'Suivre'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.chatButton} onPress={() => startChat(item.personId)} disabled={isActionLoading}>
                <Text style={styles.actionText}>Discuter</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      );
    }

    if (item.type === 'hashtag') {
      return (
        <View style={styles.resultRow}>
          <View style={styles.hashtagBadge}><Text style={styles.hashtagText}>#</Text></View>
          <View style={styles.resultInfo}>
            <Text style={styles.resultTitle}>{item.name}</Text>
            <Text style={styles.resultSubtitle}>{item.subtitle}</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.postCard}>
        <Text style={styles.postCaption}>{item.caption || 'Publication'}</Text>
        <Text style={styles.postMeta}>{item.authorName || 'Utilisateur'} • {item.type}</Text>
      </View>
    );
  };

  const bottomPadding = useSafeBottomPadding(16);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0a0c" />
        <View style={styles.loadingShell}>
          <SkeletonLoader style={[styles.skeletonCard, { width: '70%', height: 22 }]} />
          {[...Array(4)].map((_, index) => (
            <SkeletonLoader key={index} style={[styles.skeletonCard, index === 0 ? { width: '100%', height: 90 } : { width: '100%', height: 70 }]} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0c" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Résultats</Text>
        <View style={{ width: 70 }} />
      </View>

      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher..."
          placeholderTextColor="#8a8a9a"
          value={searchText}
          onChangeText={setSearchText}
          returnKeyType="search"
          onSubmitEditing={() => navigation.replace('SearchResults', { query: searchText })}
        />
      </View>

      <View style={styles.filterBar}>
        {[
          { key: 'top', label: 'Top' },
          { key: 'video', label: 'Vidéo' },
          { key: 'people', label: 'Personne' },
          { key: 'hashtag', label: 'Hashtag' },
        ].map((option) => (
          <TouchableOpacity key={option.key} style={[styles.filterChip, filter === option.key && styles.filterChipActive]} onPress={() => setFilter(option.key)}>
            <Text style={[styles.filterChipText, filter === option.key && styles.filterChipTextActive]}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredResults}
        keyExtractor={(item) => item.id || `${item.type}_${item.name}`}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContent, bottomPadding]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Aucun résultat pour “{searchText}”.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0c' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  backButton: { paddingVertical: 6 },
  backText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#141418', marginHorizontal: 16, borderRadius: 12, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, color: '#fff', fontSize: 14 },
  filterBar: { flexDirection: 'row', marginHorizontal: 16, marginTop: 10, gap: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#141418', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  filterChipActive: { backgroundColor: '#a613c4', borderColor: '#a613c4' },
  filterChipText: { color: '#c8c8d0', fontSize: 12, fontWeight: '700' },
  filterChipTextActive: { color: '#fff' },
  listContent: { paddingHorizontal: 16, paddingTop: 10 },
  resultRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#141418', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  personIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  actionsGroup: { alignItems: 'flex-end', gap: 6 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#0a0a0c' },
  hashtagBadge: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#2b1234', justifyContent: 'center', alignItems: 'center' },
  hashtagText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  resultInfo: { flex: 1, marginLeft: 12 },
  resultTitle: { color: '#f0f0f2', fontWeight: '700', fontSize: 14 },
  resultSubtitle: { color: '#8a8a9a', fontSize: 12, marginTop: 2 },
  actionButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#a613c4' },
  actionButtonSecondary: { backgroundColor: '#3a2940' },
  chatButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#2563eb' },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  postCard: { backgroundColor: '#141418', borderRadius: 14, padding: 14, marginBottom: 10 },
  postCaption: { color: '#f0f0f2', fontSize: 14 },
  postMeta: { color: '#8a8a9a', fontSize: 12, marginTop: 6 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  emptyText: { color: '#8a8a9a', fontSize: 14, textAlign: 'center' },
  loadingShell: { flex: 1, backgroundColor: '#0a0a0c', padding: 16 },
  skeletonCard: { width: '100%', height: 84, borderRadius: 18, backgroundColor: '#141418', marginBottom: 16 },
});
