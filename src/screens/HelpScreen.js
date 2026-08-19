import { addDoc, collection } from 'firebase/firestore';
import React, { useState } from 'react';
import { Alert, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../config/firebase';

export default function HelpScreen({ navigation }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) {
      Alert.alert('Message vide', 'Décrivez votre problème pour que l’équipe puisse vous aider.');
      return;
    }

    try {
      setSending(true);
      await addDoc(collection(db, 'supportMessages'), {
        userId: auth.currentUser?.uid || 'anonymous',
        email: auth.currentUser?.email || 'unknown',
        message: message.trim(),
        createdAt: new Date()
      });
      Alert.alert('Message envoyé', 'Votre demande a bien été transmise à l’équipe Meetly.');
      setMessage('');
    } catch (error) {
      Alert.alert('Erreur', 'Le message n’a pas pu être envoyé.');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0c" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>◁</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Centre d&apos;aide</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Besoin d&apos;aide ?</Text>
        <Text style={styles.text}>Décrivez votre problème et l’équipe Meetly vous répondra rapidement.</Text>
        <TextInput style={styles.input} multiline placeholder="Écrivez ici votre demande..." placeholderTextColor="#8a8a9a" value={message} onChangeText={setMessage} />
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
