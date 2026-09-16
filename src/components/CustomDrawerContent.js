import React, { useEffect, useState } from 'react';
import {
    Image,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { supabase } from '../lib/supabase';
import { getAvatarUri } from '../constants/assets';
import GlassIconBadge from './GlassIconBadge';
import {
  CoinsIcon,
  VerifiedIcon,
  ShieldIcon,
  BookmarkIcon,
  SettingsIcon,
  TrashIcon,
  LogoutIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  EyeIcon,
  SparklesIcon,
} from './icons';

export default function CustomDrawerContent({ navigation }) {
  const [openSection, setOpenSection] = useState(null);
  const [ghostMode, setGhostMode] = useState(false);
  const [dataSaver, setDataSaver] = useState(false);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      const { data: userDataResult } = await supabase.auth.getUser();
      const user = userDataResult.user;
      if (!user) return;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (active) setUserData(data ? { ...data, photoURL: data.avatar_url, displayName: data.name, isVerified: data.is_verified } : null);
    };
    loadProfile();
    return () => { active = false; };
  }, []);

  const toggleSection = (sectionName) => {
    setOpenSection(openSection === sectionName ? null : sectionName);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigation.replace('LoginScreen');
    } catch (error) {
      __DEV__ && console.warn('Erreur déconnexion:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 👤 HEADER PROFILE (Section 1) */}
      <View style={styles.profileHeader}> 
        <Image 
          source={{ uri: getAvatarUri(userData?.photoURL, userData?.displayName) }}
          style={styles.avatar} 
        />
        <View style={styles.profileInfo}>
          <Text style={styles.username}>{userData?.displayName || 'Meetly'}</Text>
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>{userData?.isVerified ? 'Compte vérifié ⚡' : 'Compte standard'}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.menuList}
        contentContainerStyle={styles.menuListContent}
        scrollEventThrottle={16}
        decelerationRate="normal"
      >
        
        {/* 📌 SECTION 1 : COMPTE & PORTEFEUILLE */}
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('ProfileScreen')}>
          <GlassIconBadge icon={<CoinsIcon size={18} color="#ffffff" />} size={34} />
          <Text style={styles.menuLabel}>Portefeuille (Meetly Coins)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Certifications')}>
          <GlassIconBadge icon={<VerifiedIcon size={18} color="#a613c4" />} size={34} />
          <Text style={styles.menuLabel}>Demander le Badge Bleu</Text>
        </TouchableOpacity>

        {/* 🔒 SECTION 2 : CONFIDENTIALITÉ & SÉCURITÉ */}
        <TouchableOpacity style={styles.dropdownHeader} onPress={() => toggleSection('privacy')}>
          <GlassIconBadge icon={<ShieldIcon size={18} color="#ffffff" />} size={34} />
          <Text style={styles.menuLabel}>Confidentialité & Sécurité</Text>
          {openSection === 'privacy' ? <ChevronDownIcon size={16} color="#8a8a9a" /> : <ChevronRightIcon size={16} color="#8a8a9a" />}
        </TouchableOpacity>
        
        {openSection === 'privacy' && (
          <View style={styles.dropdownChild}> 
            <View style={styles.subMenuItemRow}>
              <Text style={styles.subMenuLabel}>Mode Fantôme (Invisible)</Text>
              <Switch 
                value={ghostMode} 
                onValueChange={(val) => setGhostMode(val)}
                trackColor={{ false: '#24242b', true: '#a613c4' }}
              />
            </View>
            <TouchableOpacity style={styles.subMenuItem} onPress={() => navigation.navigate('BlockedUsers')}>
              <Text style={styles.subMenuLabel}>Utilisateurs Bloqués</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.subMenuItem} onPress={() => navigation.navigate('ProfileVisibility')}>
              <Text style={styles.subMenuLabel}>Visibilité du Profil</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 📝 SECTION 3 : GÉRER LES PUBLICATIONS & LIKES */}
        <TouchableOpacity style={styles.dropdownHeader} onPress={() => toggleSection('posts')}>
          <GlassIconBadge icon={<BookmarkIcon size={18} color="#ffffff" />} size={34} />
          <Text style={styles.menuLabel}>Gestion du Contenu</Text>
          {openSection === 'posts' ? <ChevronDownIcon size={16} color="#8a8a9a" /> : <ChevronRightIcon size={16} color="#8a8a9a" />}
        </TouchableOpacity>

        {openSection === 'posts' && (
          <View style={styles.dropdownChild}> 
            <TouchableOpacity style={styles.subMenuItem}>
              <Text style={styles.subMenuLabel}>Suppression / Modération</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.subMenuItem}>
              <Text style={styles.subMenuLabel}>Autorisations des Commentaires</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.subMenuItem} onPress={() => navigation.navigate('SavedPosts')}>
              <Text style={styles.subMenuLabel}>Enregistrements (Signets)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.subMenuItem}>
              <Text style={styles.subMenuLabel}>Historique des Likes</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ⚙️ SECTION 4 & 5 : PARAMÈTRES & CONFIG COMPTE */}
        <TouchableOpacity style={styles.dropdownHeader} onPress={() => toggleSection('settings')}>
          <GlassIconBadge icon={<SettingsIcon size={18} color="#ffffff" />} size={34} />
          <Text style={styles.menuLabel}>Paramètres du Compte</Text>
          {openSection === 'settings' ? <ChevronDownIcon size={16} color="#8a8a9a" /> : <ChevronRightIcon size={16} color="#8a8a9a" />}
        </TouchableOpacity>

        {openSection === 'settings' && (
          <View style={styles.dropdownChild}> 
            <TouchableOpacity style={styles.subMenuItem} onPress={() => navigation.navigate('AccountSettingsScreen', { section: 'email' })}>
              <Text style={styles.subMenuLabel}>Email et Région / Pays</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.subMenuItem} onPress={() => navigation.navigate('AccountSettingsScreen', { section: 'password' })}>
              <Text style={styles.subMenuLabel}>Mot de passe & Clé secrète</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.subMenuItem} onPress={() => navigation.navigate('AccountSettingsScreen', { section: 'algorithm' })}>
              <Text style={styles.subMenuLabel}>Préférences de l&apos;Algorithme</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.subMenuItem} onPress={() => navigation.navigate('AccountSettingsScreen', { section: 'notifications' })}>
              <Text style={styles.subMenuLabel}>Gestion des Notifications</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 🚀 SECTION 6 & 7 : OPTIMISATION & PERFORMANCE */}
        <TouchableOpacity style={styles.menuItem}>
          <GlassIconBadge icon={<TrashIcon size={18} color="#8a8a9a" />} size={34} />
          <Text style={styles.menuLabel}>Libérer de l&apos;espace (Cache)</Text>
        </TouchableOpacity>

        <View style={styles.menuItemRow}> 
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <GlassIconBadge icon={<EyeIcon size={18} color="#ffffff" />} size={34} />
            <Text style={styles.menuLabel}>Économiseur de données</Text>
          </View>
          <Switch 
            value={dataSaver} 
            onValueChange={(val) => setDataSaver(val)}
            trackColor={{ false: '#24242b', true: '#a613c4' }}
          />
        </View>

        {/* 🔒 SECTION 8 : CENTRE DE CONFIDENTIALITÉ */}
        <TouchableOpacity style={styles.dropdownHeader} onPress={() => toggleSection('privacyCenter')}>
          <GlassIconBadge icon={<SparklesIcon size={18} color="#ffffff" />} size={34} />
          <Text style={styles.menuLabel}>Centre de confidentialité</Text>
          {openSection === 'privacyCenter' ? <ChevronDownIcon size={16} color="#8a8a9a" /> : <ChevronRightIcon size={16} color="#8a8a9a" />}
        </TouchableOpacity>

        {openSection === 'privacyCenter' && (
          <View style={styles.privacyCard}> 
            <Text style={styles.privacyTitle}>Meetly protège ta vie privée 👇</Text>
            <Text style={styles.privacyText}>
              Chez Meetly, ta vie privée est une priorité absolue. Que nous introduisions de nouvelles fonctionnalités ou que nous améliorions les produits que tu aimes, nous veillons à sécuriser tes données.
            </Text>
          </View>
        )}

        <View style={styles.divider} />

        {/* 🔄 SECTION 9 : CHANGER DE COMPTE & DÉCONNEXION */}
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('HelpScreen')}>
          <GlassIconBadge icon={<ShieldIcon size={18} color="#8a8a9a" />} size={34} />
          <Text style={styles.menuLabel}>Centre d&apos;aide / Signaler</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuItem, { marginBottom: 40 }]} onPress={handleLogout}>
          <GlassIconBadge icon={<LogoutIcon size={18} color="#ff3b30" />} size={34} />
          <Text style={[styles.menuLabel, styles.logoutText]}>Déconnexion</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c', // Ton noir signature
  },
  profileHeader: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: '#a613c4',
  },
  profileInfo: {
    marginLeft: 14,
  },
  username: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  badgeContainer: {
    backgroundColor: 'rgba(166, 19, 196, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  badgeText: {
    color: '#a613c4',
    fontSize: 11,
    fontWeight: '600',
  },
  menuList: {
    flex: 1,
    paddingHorizontal: 12,
  },
  menuListContent: {
    paddingBottom: 28,
    paddingTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  menuIcon: {
    fontSize: 20,
    width: 30,
  },
  menuLabel: {
    color: '#f0f0f2',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  arrowIcon: {
    color: '#6a6a7a',
    fontSize: 12,
  },
  dropdownChild: {
    backgroundColor: '#141418', // Ta couleur grise pour les sous-sections
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 6,
  },
  subMenuItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.02)',
  },
  subMenuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  subMenuLabel: {
    color: '#8a8a9a',
    fontSize: 13,
  },
  privacyCard: {
    backgroundColor: '#141418',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderColor: '#a613c4',
  },
  privacyTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 6,
  },
  privacyText: {
    color: '#8a8a9a',
    fontSize: 12,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 14,
  },
  logoutText: {
    color: '#ff3b30',
  }
});