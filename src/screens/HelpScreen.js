import React, { useState } from 'react';
import { Alert, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useThemeStyles } from '../constants/themeStyles';
import { supabase } from '../lib/supabase';

export default function HelpScreen({ navigation }) {
  const themeStyles = useThemeStyles();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) {
      Alert.alert('Message vide', 'Décrivez votre problème pour que l’équipe puisse vous aider.');
      return;
    }

    try {
      setSending(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('unauthorized');
      const { error } = await supabase.from('support_messages').insert({ user_id: userData.user.id, message: message.trim() });
      if (error) throw error;
      Alert.alert('Message envoyé', 'Votre demande a bien été transmise à l’équipe Meetly.');
      setMessage('');
    } catch {
      Alert.alert('Erreur', 'Le message n’a pas pu être envoyé.');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, themeStyles.screen]}>
      <StatusBar barStyle={themeStyles.statusBar} backgroundColor={themeStyles.theme.background} />
      <View style={[styles.header, themeStyles.header]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backIcon, themeStyles.text]}>◁</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, themeStyles.text]}>Centre d&apos;aide</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={[styles.card, themeStyles.card]}>
        <Text style={[styles.title, themeStyles.text]}>Besoin d&apos;aide ?</Text>
        <Text style={[styles.text, themeStyles.secondaryText]}>Décrivez votre problème et l’équipe Meetly vous répondra rapidement.</Text>
        <TextInput style={[styles.input, themeStyles.input]} multiline placeholder="Écrivez ici votre demande..." placeholderTextColor={themeStyles.theme.textSecondary} value={message} onChangeText={setMessage} />
        <TouchableOpacity style={styles.button} onPress={handleSend} disabled={sending}>
          <Text style={styles.buttonText}>{sending ? 'Envoi...' : 'Envoyer'}</Text>
        </TouchableOpacity>
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
  text: { color: '#8a8a9a', lineHeight: 20, marginBottom: 12 },
  input: { minHeight: 120, backgroundColor: '#0a0a0c', color: '#fff', borderRadius: 12, padding: 12, textAlignVertical: 'top' },
  button: { marginTop: 12, backgroundColor: '#a613c4', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
});
