import { arrayRemove, doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, Image, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SkeletonLoader from '../components/SkeletonLoader';
import { auth, db } from '../config/firebase';

export default function BlockedUsersScreen({ navigation }) {
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setLoading(false);
      return;
    }

    const userRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(userRef, async (snap) => {
      if (!snap.exists()) {
        setBlockedUsers([]);
        setLoading(false);
        return;
      }

      const ids = snap.data().blockedUsers || [];
      const profiles = [];

      for (const blockedId of ids) {
        const blockedDoc = await getDoc(doc(db, 'users', blockedId));
        if (blockedDoc.exists()) {
          profiles.push({ id: blockedId, ...blockedDoc.data() });
        }
      }

      setBlockedUsers(profiles);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleUnblock = async (userId) => {
    if (!auth.currentUser?.uid) return;

    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        blockedUsers: arrayRemove(userId)
      });
      setBlockedUsers((prev) => prev.filter((user) => user.id !== userId));
      Alert.alert('Succès', 'Utilisateur débloqué.');
    } catch (error) {
      console.error('Erreur blocage:', error);
      Alert.alert('Erreur', 'Impossible de débloquer cet utilisateur.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0c" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>◁</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Utilisateurs bloqués</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          {[...Array(4)].map((_, index) => (
            <SkeletonLoader key={index} style={[styles.skeletonUserRow, index > 0 && styles.skeletonRowSpacing]} />
          ))}
        </View>
      ) : blockedUsers.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.title}>Aucun utilisateur bloqué</Text>
          <Text style={styles.text}>Vous n’avez pas encore bloqué de compte.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {blockedUsers.map((user) => (
            <View key={user.id} style={styles.userRow}>
              <Image source={{ uri: user.photoURL || 'https://via.placeholder.com/150' }} style={styles.avatar} />
              <View style={styles.userInfo}>
                <Text style={styles.displayName}>{user.displayName || 'Utilisateur'}</Text>
                <Text style={styles.username}>{user.username || '@user'}</Text>
              </View>
              <TouchableOpacity style={styles.unblockButton} onPress={() => handleUnblock(user.id)}>
                <Text style={styles.unblockButtonText}>Débloquer</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
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
  skeletonUserRow: { width: '90%', height: 82, backgroundColor: '#141418', borderRadius: 18 },
  skeletonRowSpacing: { marginTop: 14 },
  card: { margin: 16, backgroundColor: '#141418', borderRadius: 16, padding: 16 },
  title: { color: '#fff', fontWeight: '700', marginBottom: 8 },
  text: { color: '#8a8a9a', lineHeight: 20 },
  list: { padding: 16 },
  userRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#141418', borderRadius: 14, padding: 12, marginBottom: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0a0a0c' },
  userInfo: { flex: 1, marginLeft: 10 },
  displayName: { color: '#fff', fontWeight: '700' },
  username: { color: '#8a8a9a', marginTop: 2 },
  unblockButton: { backgroundColor: '#a613c4', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  unblockButtonText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
