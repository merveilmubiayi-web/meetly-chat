
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { completeNativeGoogleSession, getGoogleRedirectUri } from '../config/auth';
import { supabase } from '../lib/supabase';

export default function LoginScreen({ navigation }) {
  const initialEmail = navigation?.getState?.()?.routes?.find((route) => route.name === 'LoginScreen')?.params?.email || '';
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  WebBrowser.maybeCompleteAuthSession();

  useEffect(() => {
    const routeEmail = navigation?.getState?.()?.routes?.find((route) => route.name === 'LoginScreen')?.params?.email;
    if (routeEmail) setEmail(routeEmail);
  }, [navigation]);

  const handleGoogleLogin = async ({ testMode = false } = {}) => {
    setLoading(true);
    try {
      const redirectTo = getGoogleRedirectUri();
      console.log('[Google OAuth test]', { testMode, redirectTo });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('URL Google manquante');

      if (testMode) {
        Alert.alert('Mode test Google', `Redirect URL:\n${redirectTo}\n\nURL OAuth générée:\n${data.url}`);
        console.log('[Google OAuth URL]', data.url);
        setLoading(false);
        return;
      }

      if (typeof window !== 'undefined') {
        window.location.assign(data.url);
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success') {
        const sessionReady = await completeNativeGoogleSession(result);
        if (!sessionReady) {
          Alert.alert('Connexion Google', 'Le retour de Google a été reçu, mais la session n’a pas pu être finalisée.');
        }
      } else if (result.type === 'cancel') {
        Alert.alert('Connexion Google', 'La connexion a été annulée.');
      }
    } catch (error) {
      console.error('Supabase Google login error', error);
      Alert.alert('Connexion Google impossible', error.message || 'Configure Google dans Supabase Authentication > Providers.');
    } finally {
      setLoading(false);
    }
  };

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

      <TouchableOpacity style={[styles.button, styles.googleButton]} onPress={() => handleGoogleLogin()} disabled={loading}>
        <Text style={styles.googleButtonText}>Se connecter avec Google</Text>
      </TouchableOpacity>

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
    boxShadow: '0px 4px 5px rgba(166, 19, 196, 0.3)',
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
  testButton: {
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginTop: 12,
  },
  testButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  recentAccounts: {
    marginTop: 24,
  },
  recentTitle: {
    color: '#8a8a9a',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
  },
  recentList: {
    gap: 10,
  },
  accountItem: {
    width: 118,
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#141418',
  },
  accountAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#252530',
  },
  accountName: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
    marginTop: 6,
  },
  accountEmail: {
    color: '#8a8a9a',
    fontSize: 10,
    marginTop: 2,
  },
  otherAccountButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  otherAccountText: {
    color: '#a613c4',
    fontWeight: '700',
    fontSize: 13,
  },
  createAccountButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: '#a613c4',
  },
  createAccountText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
});