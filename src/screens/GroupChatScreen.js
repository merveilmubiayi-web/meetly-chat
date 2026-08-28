import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function GroupChatScreen({ route }) {
  const conversationId = route.params?.conversationId || route.params?.chatId;
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  useEffect(() => {
    let active = true;
    const load = async () => { const { data } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).is('deleted_at', null).order('created_at', { ascending: true }); if (active) setMessages(data || []); };
    load();
    const channel = supabase.channel(`group-${conversationId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, load).subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [conversationId]);
  const send = async () => { const text = body.trim(); if (!text) return; const { data: userData } = await supabase.auth.getUser(); if (!userData.user) return; await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: userData.user.id, body: text }); setBody(''); };
  return <View style={styles.container}><FlatList data={messages} keyExtractor={(item) => item.id} renderItem={({ item }) => <View style={styles.message}><Text style={styles.sender}>{item.sender_id}</Text><Text style={styles.body}>{item.body}</Text></View>} /><View style={styles.inputRow}><TextInput style={styles.input} value={body} onChangeText={setBody} placeholder="Message" placeholderTextColor="#888" /><TouchableOpacity style={styles.button} onPress={send}><Text style={styles.buttonText}>Envoyer</Text></TouchableOpacity></View></View>;
}
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#0a0a0c', padding: 16 }, message: { padding: 10, backgroundColor: '#191922', borderRadius: 10, marginBottom: 8 }, sender: { color: '#c56be0', fontSize: 11 }, body: { color: '#fff' }, inputRow: { flexDirection: 'row', gap: 8 }, input: { flex: 1, backgroundColor: '#1a1a21', color: '#fff', borderRadius: 10, padding: 12 }, button: { backgroundColor: '#a613c4', borderRadius: 10, padding: 12, justifyContent: 'center' }, buttonText: { color: '#fff', fontWeight: '700' } });
