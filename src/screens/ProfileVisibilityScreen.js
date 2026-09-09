import { useEffect, useState } from 'react';
import { Alert, SafeAreaView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useThemeStyles } from '../constants/themeStyles';
import { supabase } from '../lib/supabase';

export default function ProfileVisibilityScreen({ navigation }) {
  const themeStyles = useThemeStyles();
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { setLoading(false); return; }
      const { data, error } = await supabase.from('profiles').select('is_public').eq('id', userData.user.id).maybeSingle();
      if (!active) return;
      if (error) console.warn('Profile visibility load failed:', error.message);
      setIsPublic(data?.is_public ?? true);
      setLoading(false);
    };
    loadProfile();
    return () => { active = false; };
  }, []);

  const handleToggle = async (value) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    try {
      const { error } = await supabase.from('profiles').upsert({ id: userData.user.id, is_public: value }, { onConflict: 'id' });
      if (error) throw error;
      setIsPublic(value);
    } catch {
      Alert.alert('Erreur', 'Impossible de modifier la visibilité du profil.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, themeStyles.screen]}>
      <StatusBar barStyle={themeStyles.statusBar} backgroundColor={themeStyles.theme.background} />
      <View style={[styles.header, themeStyles.header]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backIcon, themeStyles.text]}>◁</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, themeStyles.text]}>Visibilité du profil</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={[styles.card, themeStyles.card]}>
        <Text style={[styles.title, themeStyles.text]}>Contrôle de visibilité</Text>
        <Text style={[styles.text, themeStyles.secondaryText]}>Choisis si votre profil est visible par les autres membres de Meetly.</Text>
        <View style={styles.row}>
          <Text style={[styles.optionText, themeStyles.text]}>{isPublic ? 'Profil public' : 'Profil privé'}</Text>
          <Switch value={isPublic} onValueChange={handleToggle} trackColor={{ false: themeStyles.theme.border, true: themeStyles.theme.accent }} thumbColor={themeStyles.theme.surface} disabled={loading} />
        </View>
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
  text: { color: '#8a8a9a', lineHeight: 20, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  optionText: { color: '#f0f0f2', fontWeight: '600' },
});
