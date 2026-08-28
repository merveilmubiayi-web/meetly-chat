import { Platform, LogBox } from 'react-native';
import 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
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

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}