import { Component } from 'react';
import { Button, Platform, LogBox, StyleSheet, Text, View } from 'react-native';
import 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import { AppProvider } from './src/contexts/AppContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';

// Register LiveKit react-native globals once at app startup on native platforms.
if (Platform.OS !== 'web') {
  try {
    const { registerGlobals } = require('@livekit/react-native');
    registerGlobals();
  } catch (e) {
    console.warn('LiveKit registerGlobals() failed or not available in this environment:', e?.message || e);
  }
}

// On ignore uniquement les alertes mineures et connues pour ne pas polluer la console,
// mais on laisse passer les erreurs critiques de connexion ou de caméra.
LogBox.ignoreLogs([
  'Setting a timer',
  'AsyncStorage has been extracted', // Alerte de migration classique
  'Warning:', // Masque les petits avertissements de structure si nécessaire
]);

class AppErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('Application render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Meetly ne peut pas charger cet écran.</Text>
          <Text style={styles.errorMessage}>Réessaie pour relancer l’affichage.</Text>
          {!!this.state.error?.message && (
            <Text selectable style={styles.errorDetails}>{this.state.error.message}</Text>
          )}
          <Button title="Réessayer" onPress={() => this.setState({ hasError: false })} />
        </View>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppProvider>
              <AppNavigator />
            </AppProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0c',
    padding: 24,
  },
  errorTitle: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  errorMessage: { color: '#b0b0b8', fontSize: 14, textAlign: 'center', marginBottom: 18 },
});