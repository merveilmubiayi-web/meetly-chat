import { useEffect, useState } from 'react';
import { Alert, Image, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SkeletonLoader from '../components/SkeletonLoader';
import { supabase } from '../lib/supabase';

export default function BlockedUsersScreen({ navigation }) {
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadBlocked = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { setLoading(false); return; }
      const { data, error } = await supabase.from('blocked_users').select('blocked_id').eq('blocker_id', userData.user.id);
      if (!active) return;
      if (error) console.warn('Blocked users load failed:', error.message);
      const ids = (data || []).map((item) => item.blocked_id);
      if (!ids.length) {
        setBlockedUsers([]);
        setLoading(false);
        return;
      }
      const { data: profiles, error: profilesError } = await supabase.from('profiles').select('*').in('id', ids);
      if (profilesError) console.warn('Blocked profiles load failed:', profilesError.message);
      setBlockedUsers((profiles || []).map((profile) => ({
        ...profile,
        id: profile.id,
        displayName: profile.name,
        photoURL: profile.avatar_url,
      })));
      setLoading(false);
    };
    loadBlocked();
    const channel = supabase.channel('blocked-users').on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_users' }, loadBlocked).subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, []);

  const handleUnblock = async (userId) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { error } = await supabase.from('blocked_users').delete().eq('blocker_id', userData.user.id).eq('blocked_id', userId);
      if (error) throw error;
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
