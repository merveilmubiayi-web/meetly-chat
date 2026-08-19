import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, SafeAreaView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../config/firebase';

export default function ProfileVisibilityScreen({ navigation }) {
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser?.uid) return;

    const userRef = doc(db, 'users', auth.currentUser.uid);
    const unsubscribe = onSnapshot(userRef, (snap) => {
      setIsPublic(snap.data()?.isPublic ?? true);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleToggle = async (value) => {
    if (!auth.currentUser?.uid) return;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { isPublic: value });
      setIsPublic(value);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de modifier la visibilité du profil.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0c" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>◁</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Visibilité du profil</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Contrôle de visibilité</Text>
        <Text style={styles.text}>Choisis si votre profil est visible par les autres membres de Meetly.</Text>
        <View style={styles.row}>
          <Text style={styles.optionText}>{isPublic ? 'Profil public' : 'Profil privé'}</Text>
          <Switch value={isPublic} onValueChange={handleToggle} trackColor={{ false: '#444', true: '#a613c4' }} thumbColor="#fff" disabled={loading} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0c' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  backIcon: { color: '#fff', fontSize: 20 },
  headerTitle: { color: '#fff', fontWeight: '700', fontSize: 16 },
  card: { margin: 16, backgroundColor: '#141418', borderRadius: 16, padding: 16 },
  title: { color: '#fff', fontWeight: '700', marginBottom: 8 },
  text: { color: '#8a8a9a', lineHeight: 20, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  optionText: { color: '#f0f0f2', fontWeight: '600' },
});
