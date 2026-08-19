import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Image, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SkeletonLoader from '../components/SkeletonLoader';
import { auth, db } from '../config/firebase';

export default function SavedPostsScreen({ navigation }) {
  const [savedPosts, setSavedPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser?.uid) {
      setLoading(false);
      return;
    }

    // On écoute la collection globale 'saved_posts' là où l'userId correspond à l'utilisateur connecté
    const savedQuery = query(
      collection(db, 'saved_posts'),
      where('userId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(savedQuery, (snapshot) => {
      const posts = [];
      snapshot.forEach((docSnap) => {
        posts.push({ id: docSnap.id, ...docSnap.data() });
      });
      setSavedPosts(posts);
      setLoading(false);
    }, (error) => {
      console.error("Erreur lors de la récupération des favoris :", error);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0c" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>◁</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Enregistrements</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          {[...Array(3)].map((_, index) => (
            <SkeletonLoader key={index} style={[styles.skeletonSavedPost, index > 0 && styles.skeletonSavedPostSpacing]} />
          ))}
        </View>
      ) : savedPosts.length === 0 ? (
        <View style={styles.card}><Text style={styles.title}>Aucun enregistrement</Text><Text style={styles.text}>Sauvegarde des publications depuis le flux principal.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {savedPosts.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.author}>{item.postAuthor || 'Auteur'}</Text>
              <Text style={styles.title}>{item.postCaption || 'Publication sauvegardée'}</Text>
              {item.postMedia ? <Image source={{ uri: item.postMedia }} style={styles.media} /> : null}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0c' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  backIcon: { color: '#fff', fontSize: 20 },
  headerTitle: { color: '#fff', fontWeight: '700', fontSize: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  skeletonSavedPost: { width: '90%', height: 140, borderRadius: 18, backgroundColor: '#141418', marginBottom: 14 },
  skeletonSavedPostSpacing: { marginTop: 10 },
  list: { padding: 16 },
  card: { backgroundColor: '#141418', borderRadius: 14, padding: 14, marginBottom: 12 },
  author: { color: '#a613c4', fontWeight: 'bold', fontSize: 12, marginBottom: 4 },
  title: { color: '#fff', fontWeight: '500', marginBottom: 4 },
  text: { color: '#8a8a9a' },
  media: { width: '100%', height: 180, borderRadius: 12, marginTop: 8, marginBottom: 8 },
});