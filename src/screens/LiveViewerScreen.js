import { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { requestLiveKitToken } from '../config/api';
import { supabase } from '../lib/supabase';

export default function LiveViewerScreen({ route, navigation }) {
  const [joining, setJoining] = useState(false);
  const room = route.params?.room;
  const join = async () => {
    setJoining(true);
    try { const { data } = await supabase.auth.getSession(); const user = data.session?.user; if (!user) throw new Error('Connexion requise'); const token = await requestLiveKitToken(room, user.id); navigation.replace('LiveCallScreen', { room, mode: 'video', token: token.token }); } catch (error) { Alert.alert('Live indisponible', error.message); } finally { setJoining(false); }
  };
  return <View style={styles.container}><Text style={styles.title}>Live</Text><Text style={styles.text}>Les spectateurs rejoignent la salle LiveKit.</Text><TouchableOpacity style={styles.button} onPress={join} disabled={joining}><Text style={styles.buttonText}>{joining ? 'Connexion...' : 'Rejoindre le live'}</Text></TouchableOpacity></View>;
}
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#0a0a0c', justifyContent: 'center', padding: 24 }, title: { color: '#fff', fontSize: 26, fontWeight: '800', marginBottom: 12 }, text: { color: '#aaa', marginBottom: 20 }, button: { backgroundColor: '#a613c4', padding: 15, borderRadius: 10, alignItems: 'center' }, buttonText: { color: '#fff', fontWeight: '700' } });
