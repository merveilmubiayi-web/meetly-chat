import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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

  const googleExpoClientId = process.env.GOOGLE_EXPO_CLIENT_ID || '';
  const googleAndroidClientId = process.env.GOOGLE_ANDROID_CLIENT_ID || '';
  const googleIosClientId = process.env.GOOGLE_IOS_CLIENT_ID || '';
  const googleWebClientId = process.env.GOOGLE_WEB_CLIENT_ID || '';
  const shouldEnableGoogle = googleWebClientId.length > 0 || googleExpoClientId.length > 0;

  const [gRequest, gResponse, gPromptAsync] = Google.useAuthRequest({
    expoClientId: googleExpoClientId,
    androidClientId: googleAndroidClientId,
    iosClientId: googleIosClientId,
    webClientId: googleWebClientId,
  });

  useEffect(() => {
    const handleGoogleResp = async () => {
      if (gResponse?.type === 'success') {
        try {
          const idToken = gResponse.authentication?.idToken || gResponse.params?.id_token;
          if (!idToken) throw new Error('No Google ID token');
          setLoading(true);
          const { error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: idToken,
          });
          if (error) throw error;
          Alert.alert('Connecté', 'Connexion Google réussie.');
          navigation.replace('HomeScreen');
        } catch (e) {
          console.error(e);
          Alert.alert('Erreur', "Impossible de se connecter via Google.");
        } finally {
          setLoading(false);
        }
      }
    };
    handleGoogleResp();
  }, [gResponse]);

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

    if (password.length < 6) {
      Alert.alert("Erreur", "Le mot de passe doit contenir au moins 6 caractères.");
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
      Alert.alert('Échec', error.message || "Impossible de créer le compte.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
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
      <TouchableOpacity style={[styles.button, styles.googleButton]} onPress={() => gPromptAsync()} disabled={!gRequest || loading}>
        <Text style={styles.googleButtonText}>Se connecter avec Google</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 32,
  },
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  title: { fontSize: 28, fontWeight: 'bold', color: '#f0f0f2', marginBottom: 32, textAlign: 'center' },
  input: { backgroundColor: '#141418', color: '#f0f0f2', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.07)' },
  codeInput: { width: 220, letterSpacing: 12, fontSize: 22, paddingVertical: 12 },
  button: { backgroundColor: '#a613c4', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  googleButton: { backgroundColor: '#fff', marginTop: 12 },
  googleButtonText: { color: '#111', fontWeight: 'bold', fontSize: 16 },
});