import { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { requestLiveKitToken } from '../config/api';
import { supabase } from '../lib/supabase';

export default function LiveStreamScreen({ navigation }) {
  const [starting, setStarting] = useState(false);
  const start = async () => {
    setStarting(true);
    try { const { data } = await supabase.auth.getSession(); const user = data.session?.user; if (!user) throw new Error('Connexion requise'); const room = `live_${user.id}`; const token = await requestLiveKitToken(room, user.id); const { error: sessionError } = await supabase.from('call_sessions').insert({ room_name: room, initiated_by: user.id, call_type: 'live', status: 'started' }); if (sessionError) throw sessionError; navigation.replace('LiveCallScreen', { room, mode: 'video', token: token.token }); } catch (error) { Alert.alert('Live indisponible', error.message); } finally { setStarting(false); }
  };
  return <View style={styles.container}><Text style={styles.title}>Démarrer un live</Text><Text style={styles.text}>Le flux vidéo est transporté par LiveKit.</Text><TouchableOpacity style={styles.button} onPress={start} disabled={starting}><Text style={styles.buttonText}>{starting ? 'Connexion...' : 'Démarrer le live'}</Text></TouchableOpacity></View>;
}
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#0a0a0c', justifyContent: 'center', padding: 24 }, title: { color: '#fff', fontSize: 26, fontWeight: '800', marginBottom: 12 }, text: { color: '#aaa', marginBottom: 20 }, button: { backgroundColor: '#a613c4', padding: 15, borderRadius: 10, alignItems: 'center' }, buttonText: { color: '#fff', fontWeight: '700' } });
