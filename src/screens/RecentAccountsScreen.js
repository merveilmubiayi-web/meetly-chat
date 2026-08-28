import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const RECENT_ACCOUNTS_KEY = '@meetly/recent-accounts';

export default function RecentAccountsScreen({ navigation }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAccounts = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(RECENT_ACCOUNTS_KEY);
      setAccounts(stored ? JSON.parse(stored) : []);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadAccounts);
    loadAccounts();
    return unsubscribe;
  }, [loadAccounts, navigation]);

  return (
    <View style={styles.container}>
      <Image source={require('../../assets/images/logo.png')} style={styles.logo} />
      <Text style={styles.title}>Bienvenue sur Meetly</Text>
      <Text style={styles.subtitle}>Choisis un compte pour continuer</Text>

      {loading ? <ActivityIndicator color="#a613c4" /> : accounts.length ? (
        <View style={styles.accountList}>
          {accounts.map((account) => (
            <TouchableOpacity
              key={account.email}
              style={styles.accountRow}
              onPress={() => navigation.navigate('LoginScreen', { email: account.email })}
            >
              <Image source={{ uri: account.avatarUrl || 'https://via.placeholder.com/80' }} style={styles.avatar} />
              <View style={styles.accountInfo}>
                <Text style={styles.accountName}>{account.name}</Text>
                <Text style={styles.accountEmail}>{account.email}</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : <Text style={styles.empty}>Aucun compte récemment utilisé</Text>}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Register')}>
          <Text style={styles.primaryText}>Créer un compte</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('LoginScreen')}>
          <Text style={styles.secondaryText}>Se connecter avec un autre compte</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0c', justifyContent: 'center', padding: 24 },
  logo: { width: 76, height: 76, alignSelf: 'center', marginBottom: 16 },
  title: { color: '#fff', fontSize: 26, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: '#8a8a9a', fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 28 },
  accountList: { gap: 10 },
  accountRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#141418', borderRadius: 14, padding: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#252530' },
  accountInfo: { flex: 1, marginLeft: 12 },
  accountName: { color: '#fff', fontWeight: '700', fontSize: 14 },
  accountEmail: { color: '#8a8a9a', fontSize: 12, marginTop: 3 },
  arrow: { color: '#a613c4', fontSize: 28 },
  empty: { color: '#8a8a9a', textAlign: 'center', marginBottom: 20 },
  actions: { marginTop: 28, gap: 10 },
  primaryButton: { backgroundColor: '#a613c4', borderRadius: 12, padding: 15, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800' },
  secondaryButton: { borderWidth: 1, borderColor: '#a613c4', borderRadius: 12, padding: 14, alignItems: 'center' },
  secondaryText: { color: '#c56be0', fontWeight: '700', textAlign: 'center' },
});
