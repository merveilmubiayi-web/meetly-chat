import { collection, query as firestoreQuery, onSnapshot, orderBy } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SkeletonLoader from '../components/SkeletonLoader';
import { db } from '../config/firebase';
import { useSafeBottomPadding } from '../utils/safeAreaHelpers';

export default function SearchResultsScreen({ navigation, route }) {
  const initialSearch = route?.params?.query || '';
  const [searchText, setSearchText] = useState(initialSearch);
  const [filter, setFilter] = useState('top');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const postsRef = collection(db, 'posts');
    const q = firestoreQuery(postsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data && (data.type === 'text' || data.type === 'image' || data.type === 'video')) {
          list.push({ id: d.id, ...data });
        }
      });
      setPosts(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const normalizedQuery = (searchText || '').trim().toLowerCase();

  const results = useMemo(() => {
    if (!normalizedQuery) return [];

    const people = posts
      .filter((post) => (post.authorName || '').toLowerCase().includes(normalizedQuery))
      .map((post) => ({
        id: `person_${post.authorId || post.id}`,
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

  const renderItem = ({ item }) => {
    if (item.type === 'person') {
      return (
        <View style={styles.resultRow}>
          <Image source={{ uri: item.avatar || 'https://via.placeholder.com/150' }} style={styles.avatar} />
          <View style={styles.resultInfo}>
            <Text style={styles.resultTitle}>{item.name}</Text>
            <Text style={styles.resultSubtitle}>{item.subtitle}</Text>
          </View>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionText}>Voir</Text>
          </TouchableOpacity>
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
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#0a0a0c' },
  hashtagBadge: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#2b1234', justifyContent: 'center', alignItems: 'center' },
  hashtagText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  resultInfo: { flex: 1, marginLeft: 12 },
  resultTitle: { color: '#f0f0f2', fontWeight: '700', fontSize: 14 },
  resultSubtitle: { color: '#8a8a9a', fontSize: 12, marginTop: 2 },
  actionButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#a613c4' },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  postCard: { backgroundColor: '#141418', borderRadius: 14, padding: 14, marginBottom: 10 },
  postCaption: { color: '#f0f0f2', fontSize: 14 },
  postMeta: { color: '#8a8a9a', fontSize: 12, marginTop: 6 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  emptyText: { color: '#8a8a9a', fontSize: 14, textAlign: 'center' },
  loadingShell: { flex: 1, backgroundColor: '#0a0a0c', padding: 16 },
  skeletonCard: { width: '100%', height: 84, borderRadius: 18, backgroundColor: '#141418', marginBottom: 16 },
});
