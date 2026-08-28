import { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function CreateGroupScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { supabase.from('profiles').select('*').limit(50).then(({ data }) => setUsers(data || [])); }, []);
  const toggle = (id) => setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  const create = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return Alert.alert('Connexion requise', 'Connecte-toi pour créer un groupe.');
    if (!title.trim() || !selected.length) return Alert.alert('Informations manquantes', 'Ajoute un nom et au moins un membre.');
    setSaving(true);
    try {
      const { data: conversation, error } = await supabase.from('conversations').insert({ title: title.trim(), is_group: true, created_by: userData.user.id }).select().single();
      if (error) throw error;
      const members = [{ conversation_id: conversation.id, user_id: userData.user.id, role: 'admin' }, ...selected.filter((id) => id !== userData.user.id).map((id) => ({ conversation_id: conversation.id, user_id: id, role: 'member' }))];
      const { error: memberError } = await supabase.from('conversation_members').insert(members);
      if (memberError) throw memberError;
      navigation.replace('ChatRoom', { chatId: conversation.id });
    } catch (error) { Alert.alert('Erreur', error.message); } finally { setSaving(false); }
  };
  return <View style={styles.container}><Text style={styles.title}>Créer un groupe</Text><TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Nom du groupe" placeholderTextColor="#888" /><FlatList data={users} keyExtractor={(item) => item.id} renderItem={({ item }) => <TouchableOpacity style={styles.row} onPress={() => toggle(item.id)}><Text style={styles.name}>{item.name || item.username || item.id}</Text><Text style={styles.check}>{selected.includes(item.id) ? '✓' : ''}</Text></TouchableOpacity>} /><TouchableOpacity style={styles.button} onPress={create} disabled={saving}><Text style={styles.buttonText}>{saving ? 'Création...' : 'Créer le groupe'}</Text></TouchableOpacity></View>;
}
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#0a0a0c', padding: 20 }, title: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 20 }, input: { backgroundColor: '#1a1a21', color: '#fff', padding: 14, borderRadius: 10, marginBottom: 14 }, row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#24242d' }, name: { color: '#fff' }, check: { color: '#c56be0', fontSize: 20 }, button: { backgroundColor: '#a613c4', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 12 }, buttonText: { color: '#fff', fontWeight: '700' } });
