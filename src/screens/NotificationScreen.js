import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import SkeletonLoader from '../components/SkeletonLoader';
import { auth, db } from '../config/firebase';

export default function NotificationScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!auth.currentUser?.uid) {
      setLoading(false);
      return;
    }

    const notificationsRef = collection(db, 'notifications');
    const q = query(notificationsRef, where('recipientId', '==', auth.currentUser.uid), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setItems(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0c" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>◁</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.centerLoading}>
          <SkeletonLoader style={styles.skeletonCard} />
          <SkeletonLoader style={[styles.skeletonCard, styles.skeletonCardSpacer]} />
          <SkeletonLoader style={[styles.skeletonCard, styles.skeletonCardSpacer]} />
        </View>
      ) : (
        <View style={[styles.list, { paddingBottom: 80 + insets.bottom }]}> 
          {items.length === 0 ? (
            <View style={styles.card}><Text style={styles.title}>Aucune notification</Text><Text style={styles.text}>Les nouvelles activités apparaîtront ici.</Text></View>
          ) : items.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.text}>{item.message || item.text}</Text>
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
  list: { padding: 16 },
  card: { backgroundColor: '#141418', borderRadius: 14, padding: 14, marginBottom: 12 },
  title: { color: '#fff', fontWeight: '700', marginBottom: 4 },
  text: { color: '#8a8a9a' },
  skeletonCard: {
    width: '90%',
    height: 90,
    borderRadius: 18,
    backgroundColor: '#141418',
    marginBottom: 14,
    alignSelf: 'center',
  },
  skeletonCardSpacer: {
    marginTop: 6,
  },
});
