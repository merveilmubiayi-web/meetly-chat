import React, { useState } from 'react';
import { Alert, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useThemeStyles } from '../constants/themeStyles';
import { supabase } from '../lib/supabase';

export default function CertificationsScreen({ navigation }) {
  const themeStyles = useThemeStyles();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      Alert.alert('Informations manquantes', 'Expliquez pourquoi vous souhaitez une vérification.');
      return;
    }

    try {
      setSubmitting(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('unauthorized');
      const { error } = await supabase.from('verification_requests').insert({ user_id: userData.user.id, reason: reason.trim() });
      if (error) throw error;
      Alert.alert('Demande envoyée', 'Votre demande de vérification a bien été enregistrée.');
      setReason('');
    } catch {
      Alert.alert('Erreur', 'La demande n’a pas pu être envoyée.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, themeStyles.screen]}>
      <StatusBar barStyle={themeStyles.statusBar} backgroundColor={themeStyles.theme.background} />
      <View style={[styles.header, themeStyles.header]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backIcon, themeStyles.text]}>◁</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, themeStyles.text]}>Badge bleu</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={[styles.card, themeStyles.card]}>
        <Text style={[styles.title, themeStyles.text]}>Demande de vérification</Text>
        <Text style={[styles.text, themeStyles.secondaryText]}>Soumettez votre demande pour obtenir un badge de vérification sur Meetly.</Text>
        <TextInput style={[styles.input, themeStyles.input]} placeholder="Pourquoi voulez-vous être vérifié ?" placeholderTextColor={themeStyles.theme.textSecondary} value={reason} onChangeText={setReason} multiline />
        <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={submitting}>
          <Text style={styles.buttonText}>{submitting ? 'Envoi...' : 'Envoyer la demande'}</Text>
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
  input: { minHeight: 110, backgroundColor: '#0a0a0c', color: '#fff', borderRadius: 12, padding: 12, textAlignVertical: 'top' },
  button: { marginTop: 12, backgroundColor: '#a613c4', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
});
