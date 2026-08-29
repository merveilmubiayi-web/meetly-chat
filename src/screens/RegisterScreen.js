import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { completeNativeGoogleSession, getGoogleRedirectUri } from '../config/auth';
import { supabase } from '../lib/supabase';

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  WebBrowser.maybeCompleteAuthSession();

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const redirectTo = getGoogleRedirectUri();
      const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
      if (error) throw error;
      if (!data?.url) throw new Error('URL Google manquante');
      if (typeof window !== 'undefined') {
        window.location.assign(data.url);
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success') await completeNativeGoogleSession(result);
    } catch (error) {
      console.error('Supabase Google login error', error);
      Alert.alert('Connexion Google impossible', error.message || 'Configure Google dans Supabase Authentication > Providers.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!name || !username || !email || !password || !confirmPassword) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs obligatoires.");
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phoneNumber.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[0-9\s-]{7,15}$/;

    if (!emailRegex.test(trimmedEmail)) {
      Alert.alert("Erreur", "Veuillez saisir une adresse e-mail valide.");
      return;
    }

    if (trimmedPhone && !phoneRegex.test(trimmedPhone)) {
      Alert.alert("Erreur", "Le numéro de téléphone n'est pas valide.");
      return;
    }

    const passwordHasRequiredFormat = password.length >= 8
      && /[A-Z]/.test(password)
      && /[^A-Za-z0-9]/.test(password);
    if (!passwordHasRequiredFormat) {
      Alert.alert("Erreur", "Le mot de passe doit contenir au moins 8 caractères, une majuscule et un symbole.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Erreur", "Les deux mots de passe ne correspondent pas.");
      return;
    }

    const formattedUsername = username.startsWith('@') ? username : `@${username}`;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            name: name.trim(),
            username: formattedUsername,
            phoneNumber: trimmedPhone || null,
          },
        },
      });
      if (error) throw error;
      if (data.session) {
        Alert.alert('Compte créé', 'Votre compte a été créé.');
        navigation.replace('HomeScreen');
      } else {
        Alert.alert('Vérification requise', 'Consultez votre e-mail pour confirmer votre compte.');
        navigation.replace('LoginScreen');
      }
    } catch (error) {
      console.error('Supabase registration error', error);
      const message = error.status === 500 && error.message?.toLowerCase().includes('confirmation email')
        ? "Le serveur d'e-mails Supabase n'est pas configuré. Désactive la confirmation e-mail dans Authentication > Providers > Email, ou configure un SMTP."
        : error.message || "Impossible de créer le compte.";
      Alert.alert('Échec de création', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContainer}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.container}
    >
      <Text style={styles.title}>Rejoins Meetly ✨</Text>

      <TextInput style={styles.input} placeholder="Nom complet" placeholderTextColor="#8a8a9a" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Nom d'utilisateur" placeholderTextColor="#8a8a9a" value={username} onChangeText={setUsername} autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Adresse e-mail" placeholderTextColor="#8a8a9a" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Numéro de téléphone (optionnel)" placeholderTextColor="#8a8a9a" value={phoneNumber} onChangeText={setPhoneNumber} keyboardType="phone-pad" autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Mot de passe" placeholderTextColor="#8a8a9a" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Confirmer le mot de passe" placeholderTextColor="#8a8a9a" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" />

      <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Créer mon compte</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={[styles.button, styles.googleButton]} onPress={handleGoogleLogin} disabled={loading}>
        <Text style={styles.googleButtonText}>Se connecter avec Google</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 32,
  },
  container: {
    backgroundColor: '#0a0a0c',
    flex: 1,
  },
  title: { fontSize: 28, fontWeight: 'bold', color: '#f0f0f2', marginBottom: 32, textAlign: 'center' },
  input: { backgroundColor: '#141418', color: '#f0f0f2', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.07)' },
  codeInput: { width: 220, letterSpacing: 12, fontSize: 22, paddingVertical: 12 },
  button: { backgroundColor: '#a613c4', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  googleButton: { backgroundColor: '#fff', marginTop: 12 },
  googleButtonText: { color: '#111', fontWeight: 'bold', fontSize: 16 },
});