
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  WebBrowser.maybeCompleteAuthSession();

  const webClientId = process.env.GOOGLE_WEB_CLIENT_ID || '';
  const shouldEnableGoogle = webClientId.length > 0;

  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: process.env.GOOGLE_EXPO_CLIENT_ID || '',
    androidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID || '',
    iosClientId: process.env.GOOGLE_IOS_CLIENT_ID || '',
    webClientId,
  });

  useEffect(() => {
    const handleGoogleResponse = async () => {
      if (response?.type === 'success') {
        try {
          const idToken = response.authentication?.idToken || response.params?.id_token;
          if (!idToken) throw new Error('No Google ID token');
          setLoading(true);
          const { error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: idToken,
          });
          if (error) throw error;
          Alert.alert('Connecté', 'Connexion Google réussie.');
          navigateTo('HomeScreen', 'replace');
        } catch (e) {
          console.error(e);
          Alert.alert('Erreur', "Impossible de se connecter via Google.");
        } finally {
          setLoading(false);
        }
      }
    };
    handleGoogleResponse();
  }, [response]);

  const navigateTo = (screen, action = 'navigate') => {
    if (action === 'replace') navigation.replace(screen);
    else navigation.navigate(screen);
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Champs incomplets", "Veuillez saisir votre e-mail et votre mot de passe.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;

      Alert.alert("Connexion réussie", "Ravi de vous revoir sur Meetly !");
      navigateTo('HomeScreen', 'replace');

    } catch (error) {
      console.error(error);
      let msg = "Identifiants incorrects ou compte inexistant.";
      if (error.code === 'invalid_credentials') {
        msg = "E-mail ou mot de passe incorrect.";
      }
      if (error.message?.toLowerCase().includes('email')) msg = "Le format de l'adresse e-mail est invalide.";
      Alert.alert("Échec de la connexion", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Image source={require('../../assets/images/logo.png')} style={styles.logoIcon} />
        <Text style={styles.logoText}>MEETLY</Text>
      </View>
      <Text style={styles.subtitle}>Connecte-toi pour interagir avec tes proches ✨</Text>

      <TextInput 
        style={styles.input} 
        placeholder="Adresse e-mail" 
        placeholderTextColor="#8a8a9a" 
        value={email} 
        onChangeText={setEmail} 
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput 
        style={styles.input} 
        placeholder="Mot de passe" 
        placeholderTextColor="#8a8a9a" 
        value={password} 
        onChangeText={setPassword} 
        secureTextEntry
        autoCapitalize="none"
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Se connecter</Text>}
      </TouchableOpacity>

      {shouldEnableGoogle ? (
        <TouchableOpacity style={[styles.button, styles.googleButton]} onPress={() => promptAsync()} disabled={!request || loading}>
          <Text style={styles.googleButtonText}>Se connecter avec Google</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity style={styles.linkContainer} onPress={() => navigateTo('Register')}>
        <Text style={styles.linkText}>Nouveau sur Meetly ? <Text style={styles.linkHighlight}>Crée ton compte</Text></Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c', // Design sombre unifié
    justifyContent: 'center',
    padding: 24,
    display: 'flex',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    display: 'flex',
  },
  logoIcon: {
    width: 72,
    height: 72,
    marginBottom: 10,
    resizeMode: 'contain',
  },
  logoText: {
    fontSize: 36,
    fontWeight: '900',
    color: '#fff', 
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#8a8a9a',
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 10,
  },
  input: {
    backgroundColor: '#141418',
    color: '#f0f0f2',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  button: {
    backgroundColor: '#a613c4', // Violet emblématique de Meetly
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#a613c4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  linkContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  linkText: {
    color: '#8a8a9a',
    fontSize: 14,
  },
  linkHighlight: {
    color: '#a613c4',
    fontWeight: 'bold',
  },
  googleButton: {
    backgroundColor: '#fff',
    marginTop: 12,
  },
  googleButtonText: {
    color: '#111',
    fontWeight: 'bold',
    fontSize: 16,
  },
});