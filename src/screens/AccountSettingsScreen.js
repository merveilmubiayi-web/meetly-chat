import { EmailAuthProvider, reauthenticateWithCredential, updateEmail, updatePassword } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { auth, db } from '../config/firebase';

export default function AccountSettingsScreen({ navigation, route }) {
  const routeSection = route.params?.section || 'email';
  const [activeSection, setActiveSection] = useState(routeSection);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [region, setRegion] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [algorithmPreferences, setAlgorithmPreferences] = useState({});
  const [notificationSettings, setNotificationSettings] = useState({});
  const [savingRegion, setSavingRegion] = useState(false);

  useEffect(() => {
    if (route.params?.section) {
      setActiveSection(route.params.section);
    }
  }, [route.params?.section]);

  useEffect(() => {
    if (!auth.currentUser?.uid) return;
    const userRef = doc(db, 'users', auth.currentUser.uid);
    const unsubscribe = onSnapshot(userRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setUserData(data);
      setEmail(data.email || auth.currentUser.email || '');
      setRegion(data.region || '');
      setAlgorithmPreferences(data.algorithmPreferences || {
        boostFriends: true,
        showNewPostsFirst: true,
        reduceSponsored: false,
      });
      setNotificationSettings(data.notificationSettings || {
        likes: true,
        comments: true,
        newFollowers: true,
        liveFriends: true,
      });
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const userRef = auth.currentUser ? doc(db, 'users', auth.currentUser.uid) : null;

  const reauthenticate = async (password) => {
    if (!auth.currentUser?.email) {
      throw new Error('Utilisateur non connecté.');
    }
    const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
    await reauthenticateWithCredential(auth.currentUser, credential);
  };

  const handleUpdateEmail = async () => {
    if (!email || !email.trim()) {
      Alert.alert('Email requis', 'Saisis une adresse e-mail valide.');
      return;
    }
    if (email.trim().toLowerCase() === auth.currentUser?.email) {
      Alert.alert('Aucune modification', 'L’adresse e-mail est déjà celle du compte.');
      return;
    }
    if (!currentPassword) {
      Alert.alert('Mot de passe requis', 'Saisis ton mot de passe actuel pour confirmer.');
      return;
    }

    try {
      setSavingEmail(true);
      await reauthenticate(currentPassword);
      await updateEmail(auth.currentUser, email.trim().toLowerCase());
      if (userRef) {
        await updateDoc(userRef, { email: email.trim().toLowerCase() });
      }
      Alert.alert('Email mis à jour', 'Ton adresse e-mail a bien été modifiée.');
      setCurrentPassword('');
    } catch (error) {
      console.error('Erreur mise à jour e-mail :', error);
      Alert.alert('Erreur', error.message || 'Impossible de mettre à jour l’adresse e-mail.');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Champs manquants', 'Remplis tous les champs pour modifier le mot de passe.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Mot de passe trop court', 'Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Confirmation incorrecte', 'Les deux mots de passe doivent correspondre.');
      return;
    }

    try {
      setSavingPassword(true);
      await reauthenticate(currentPassword);
      await updatePassword(auth.currentUser, newPassword);
      Alert.alert('Mot de passe mis à jour', 'Ton mot de passe a bien été modifié.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Erreur mise à jour mot de passe :', error);
      Alert.alert('Erreur', error.message || 'Impossible de mettre à jour le mot de passe.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSaveRegion = async () => {
    if (!userRef) return;
    try {
      setSavingRegion(true);
      await updateDoc(userRef, { region: region.trim() });
      Alert.alert('Région sauvegardée', 'Ta région a bien été mise à jour.');
    } catch (error) {
      console.error('Erreur sauvegarde région :', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder la région.');
    } finally {
      setSavingRegion(false);
    }
  };

  const toggleAlgorithmPreference = async (key) => {
    if (!userRef) return;
    const nextPrefs = { ...algorithmPreferences, [key]: !algorithmPreferences[key] };
    setAlgorithmPreferences(nextPrefs);
    await updateDoc(userRef, { algorithmPreferences: nextPrefs });
  };

  const toggleNotificationSetting = async (key) => {
    if (!userRef) return;
    const nextSettings = { ...notificationSettings, [key]: !notificationSettings[key] };
    setNotificationSettings(nextSettings);
    await updateDoc(userRef, { notificationSettings: nextSettings });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0c" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backIcon}>◁</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Paramètres du compte</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.tabRow}>
            {[
              { key: 'email', label: 'Email' },
              { key: 'password', label: 'Mot de passe' },
              { key: 'algorithm', label: 'Algorithme' },
              { key: 'notifications', label: 'Notifications' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabButton, activeSection === tab.key && styles.activeTabButton]}
                onPress={() => setActiveSection(tab.key)}
              >
                <Text style={[styles.tabButtonText, activeSection === tab.key && styles.activeTabButtonText]}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeSection === 'email' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Email et région</Text>
              <Text style={styles.sectionText}>Modifie ton e-mail et ta localisation pour ton compte Meetly.</Text>
              <Text style={styles.fieldLabel}>Adresse e-mail</Text>
              <TextInput
                style={styles.input}
                placeholder="Nouvel e-mail"
                placeholderTextColor="#8a8a9a"
                value={email}
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={setEmail}
              />
              <Text style={styles.fieldLabel}>Mot de passe actuel</Text>
              <TextInput
                style={styles.input}
                placeholder="Mot de passe actuel"
                placeholderTextColor="#8a8a9a"
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />
              <TouchableOpacity style={styles.primaryButton} onPress={handleUpdateEmail} disabled={savingEmail}>
                <Text style={styles.primaryButtonText}>{savingEmail ? 'Enregistrement...' : 'Mettre à jour l’e-mail'}</Text>
              </TouchableOpacity>
              <Text style={styles.fieldLabel}>Région / Pays</Text>
              <TextInput
                style={styles.input}
                placeholder="France, Maroc, Sénégal..."
                placeholderTextColor="#8a8a9a"
                value={region}
                onChangeText={setRegion}
              />
              <TouchableOpacity style={[styles.secondaryButton, styles.marginBottom]} onPress={handleSaveRegion} disabled={savingRegion}>
                <Text style={styles.secondaryButtonText}>{savingRegion ? 'Sauvegarde...' : 'Sauvegarder la région'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {activeSection === 'password' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Mot de passe</Text>
              <Text style={styles.sectionText}>Change ton mot de passe actuel en toute sécurité.</Text>
              <Text style={styles.fieldLabel}>Mot de passe actuel</Text>
              <TextInput
                style={styles.input}
                placeholder="Mot de passe actuel"
                placeholderTextColor="#8a8a9a"
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />
              <Text style={styles.fieldLabel}>Nouveau mot de passe</Text>
              <TextInput
                style={styles.input}
                placeholder="Nouveau mot de passe"
                placeholderTextColor="#8a8a9a"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <Text style={styles.fieldLabel}>Confirmer le mot de passe</Text>
              <TextInput
                style={styles.input}
                placeholder="Confirmer le mot de passe"
                placeholderTextColor="#8a8a9a"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <TouchableOpacity style={styles.primaryButton} onPress={handleUpdatePassword} disabled={savingPassword}>
                <Text style={styles.primaryButtonText}>{savingPassword ? 'Enregistrement...' : 'Modifier le mot de passe'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {activeSection === 'algorithm' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Préférences de l’algorithme</Text>
              <Text style={styles.sectionText}>Choisis comment Meetly trie ton flux.</Text>
              {['boostFriends', 'showNewPostsFirst', 'reduceSponsored'].map((key) => (
                <View key={key} style={styles.toggleRow}>
                  <View style={styles.toggleTextGroup}>
                    <Text style={styles.toggleLabel}>
                      {key === 'boostFriends' ? 'Favoriser les amis' : key === 'showNewPostsFirst' ? 'Publications récentes en premier' : 'Réduire les contenus sponsorisés'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.toggleButton, algorithmPreferences[key] ? styles.toggleOn : styles.toggleOff]}
                    onPress={() => toggleAlgorithmPreference(key)}
                  >
                    <Text style={styles.toggleButtonText}>{algorithmPreferences[key] ? 'Activé' : 'Désactivé'}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {activeSection === 'notifications' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Gestion des notifications</Text>
              <Text style={styles.sectionText}>Active ou désactive les notifications que tu souhaites recevoir.</Text>
              {['likes', 'comments', 'newFollowers', 'liveFriends'].map((key) => (
                <View key={key} style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>
                    {key === 'likes' ? 'Likes' : key === 'comments' ? 'Commentaires' : key === 'newFollowers' ? 'Nouveaux abonnés' : 'Amis en live'}
                  </Text>
                  <TouchableOpacity
                    style={[styles.toggleButton, notificationSettings[key] ? styles.toggleOn : styles.toggleOff]}
                    onPress={() => toggleNotificationSetting(key)}
                  >
                    <Text style={styles.toggleButtonText}>{notificationSettings[key] ? 'Oui' : 'Non'}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0a0a0c' },
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  backButton: { padding: 6 },
  backIcon: { color: '#fff', fontSize: 20 },
  headerTitle: { color: '#fff', fontWeight: '700', fontSize: 16 },
  content: { paddingHorizontal: 16, paddingBottom: 36 },
  section: { marginTop: 18, backgroundColor: '#141418', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  sectionText: { color: '#8a8a9a', fontSize: 13, lineHeight: 20, marginBottom: 14 },
  fieldLabel: { color: '#c6c6ce', fontSize: 12, marginBottom: 8, fontWeight: '600' },
  input: { backgroundColor: '#0a0a0c', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  primaryButton: { backgroundColor: '#a613c4', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: { backgroundColor: '#24242b', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  secondaryButtonText: { color: '#fff', fontWeight: '700' },
  marginBottom: { marginBottom: 10 },
  tabRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 18, gap: 8 },
  tabButton: { flex: 1, minWidth: 100, paddingVertical: 12, borderRadius: 14, backgroundColor: '#141418', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', marginBottom: 8 },
  activeTabButton: { backgroundColor: '#a613c4', borderColor: '#8f1ebb' },
  tabButtonText: { color: '#fff', fontWeight: '600' },
  activeTabButtonText: { color: '#fff' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  toggleTextGroup: { flex: 1, paddingRight: 12 },
  toggleLabel: { color: '#f0f0f2', fontSize: 14, fontWeight: '600' },
  toggleButton: { minWidth: 88, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 14, alignItems: 'center' },
  toggleOn: { backgroundColor: '#a613c4' },
  toggleOff: { backgroundColor: '#24242b' },
  toggleButtonText: { color: '#fff', fontWeight: '700' },
});
