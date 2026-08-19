import { addDoc, collection } from 'firebase/firestore';
import React, { useState } from 'react';
import { Alert, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../config/firebase';

export default function CertificationsScreen({ navigation }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!auth.currentUser?.uid) return;
    if (!reason.trim()) {
      Alert.alert('Informations manquantes', 'Expliquez pourquoi vous souhaitez une vérification.');
      return;
    }

    try {
      setSubmitting(true);
      await addDoc(collection(db, 'verificationRequests'), {
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email || '',
        reason: reason.trim(),
        status: 'pending',
        createdAt: new Date()
      });
      Alert.alert('Demande envoyée', 'Votre demande de vérification a bien été enregistrée.');
      setReason('');
    } catch (error) {
      Alert.alert('Erreur', 'La demande n’a pas pu être envoyée.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0c" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>◁</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Badge bleu</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Demande de vérification</Text>
        <Text style={styles.text}>Soumettez votre demande pour obtenir un badge de vérification sur Meetly.</Text>
        <TextInput style={styles.input} placeholder="Pourquoi voulez-vous être vérifié ?" placeholderTextColor="#8a8a9a" value={reason} onChangeText={setReason} multiline />
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
