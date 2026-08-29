import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
    Alert,
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
    ImageBackground,
    Modal,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import SkeletonLoader from '../components/SkeletonLoader';
import CommentGlyph from '../components/CommentGlyph';
import GlassIconBadge from '../components/GlassIconBadge';
import { supabase } from '../lib/supabase';
import { uploadToCloudinary } from '../utils/cloudinaryUpload';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = width / 3 - 2;

export default function ProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const [sessionUser, setSessionUser] = useState(null);
  const userId = route.params?.userId || sessionUser?.id;
  const isOwnProfile = userId === sessionUser?.id;

  const [userData, setUserData] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isAvatarViewerVisible, setAvatarViewerVisible] = useState(false);
  const [isBioModalVisible, setBioModalVisible] = useState(false);
  const [bioDraft, setBioDraft] = useState('');
  
  // Onglet de filtre sélectionné (posts, aimés, épinglés)
  const [activeTab, setActiveTab] = useState('posts'); 
  const insets = useSafeAreaInsets();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSessionUser(data.user || null));
  }, []);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const loadProfile = async () => {
      const [profileResult, postsResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('posts').select('*').eq('author_id', userId).in('type', ['text', 'image']).order('created_at', { ascending: false }),
      ]);
      if (!active) return;
      if (profileResult.error || postsResult.error) {
        console.error('Erreur profil Supabase :', profileResult.error?.message || postsResult.error?.message);
        setLoading(false);
        return;
      }
      const profile = profileResult.data;
      setUserData(profile ? {
        ...profile,
        displayName: profile.name,
        username: profile.username?.replace(/^@/, ''),
        phoneNumber: profile.phone_number,
        photoURL: profile.avatar_url,
        coverUrl: profile.cover_url,
      } : null);
      setUserPosts((postsResult.data || []).map((post) => ({
        ...post,
        authorId: post.author_id,
        mediaUrl: post.media_url,
        likedBy: post.liked_by,
        isPinned: post.is_pinned,
      })));
      setLoading(false);
    };
    loadProfile();
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    setBioDraft(userData?.bio || '');
  }, [userData]);

  const handleUpdateProfilePicture = async () => {
    if (!isOwnProfile) return;
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('Permission requise', 'L\'accès aux photos est nécessaire.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      await uploadToCloudinaryAndSupabase(result.assets[0].uri, 'photoURL');
    }
  };

  const handleUpdateCoverImage = async () => {
    if (!isOwnProfile) return;
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('Permission requise', 'L\'accès aux photos est nécessaire.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      await uploadToCloudinaryAndSupabase(result.assets[0].uri, 'coverUrl');
    }
  };

  const uploadToCloudinaryAndSupabase = async (localUri, field) => {
    if (!sessionUser?.id) {
      Alert.alert('Connexion requise', 'Reconnecte-toi avant de modifier ta couverture.');
      return;
    }
    if (!localUri) {
      Alert.alert('Image invalide', 'Sélectionne une image valide.');
      return;
    }
    setUploading(true);
    try {
      const fileName = `${field === 'coverUrl' ? 'cover' : 'avatar'}_${sessionUser.id}_${Date.now()}.jpg`;
      const secureUrl = await uploadToCloudinary(localUri, { resourceType: 'image', fileName });
      if (!secureUrl) throw new Error('Cloudinary n’a pas retourné d’URL pour cette image.');
      const updateData = {};
      if (field === 'coverUrl') {
        updateData.cover_url = secureUrl;
      } else {
        updateData.avatar_url = secureUrl;
        await supabase.auth.updateUser({ data: { avatar_url: secureUrl } });
      }

      const { error } = await supabase.from('profiles').upsert({ id: sessionUser.id, ...updateData }, { onConflict: 'id' });
      if (error) throw error;
      const { data: refreshedProfile } = await supabase.from('profiles').select('*').eq('id', sessionUser.id).maybeSingle();
      const nextProfile = refreshedProfile || { ...userData, ...updateData };
      setUserData({
        ...nextProfile,
        displayName: nextProfile.name,
        username: nextProfile.username?.replace(/^@/, ''),
        photoURL: nextProfile.avatar_url,
        coverUrl: nextProfile.cover_url,
      });
      Alert.alert('Succès', field === 'coverUrl' ? 'Couverture mise à jour !' : 'Photo de profil mise à jour !');
    } catch (error) {
      console.error('Erreur téléversement profil:', error);
      const msg = error?.message || '';
      if (msg.includes('Cloudinary') || msg.includes('signature') || msg.includes('503')) {
        Alert.alert('Erreur', 'Le service Cloudinary ou l’Edge Function Supabase n’est pas configuré.');
      } else if (msg.includes('cover_url') || msg.includes('column')) {
        Alert.alert('Base de données', 'La colonne cover_url manque dans Supabase. Exécute le schéma Supabase mis à jour.');
      } else {
        Alert.alert('Erreur', error.message || 'Le téléversement a échoué.');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => supabase.auth.signOut().catch(console.error);

  const handleSaveBio = async () => {
    if (!isOwnProfile) return;
    try {
      const { error } = await supabase.from('profiles').upsert({ id: sessionUser.id, bio: bioDraft }, { onConflict: 'id' });
      if (error) throw error;
      setUserData((prev) => ({ ...prev, bio: bioDraft }));
      setBioModalVisible(false);
      Alert.alert('Profil', 'Votre description a été mise à jour.');
    } catch (error) {
      console.error('Erreur mise à jour bio :', error);
      Alert.alert('Erreur', "Impossible de mettre à jour votre description.");
    }
  };

  const getFilteredPosts = () => {
    if (activeTab === 'liked') {
      return userPosts.filter(post => post.likedBy?.includes(sessionUser?.id));
    }
    if (activeTab === 'pinned') {
      return userPosts.filter(post => post.isPinned === true);
    }
    return userPosts; // Mode 'posts' (📲) par défaut
  };

  const renderGridItem = ({ item }) => (
    <TouchableOpacity style={styles.gridItem}>
      {item.type === 'image' && item.mediaUrl ? (
        <Image source={{ uri: item.mediaUrl }} style={styles.gridImage} />
      ) : (
        <View style={styles.gridTextCard}>
          <Text style={styles.gridTextCardContent} numberOfLines={3}>{item.caption}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0a0c" />
        <View style={styles.profileSkeletonContainer}>
          <SkeletonLoader style={styles.skeletonCover} />
          <View style={styles.profileSkeletonHeader}>
            <SkeletonLoader style={styles.skeletonAvatar} />
            <View style={styles.profileSkeletonTextGroup}>
              <SkeletonLoader style={styles.skeletonName} />
              <SkeletonLoader style={styles.skeletonSubline} />
            </View>
          </View>
          <View style={styles.skeletonStatsRow}>
            {[...Array(3)].map((_, index) => (
              <SkeletonLoader key={index} style={styles.skeletonStat} />
            ))}
          </View>
          <View style={styles.profileSkeletonTabs}>
            {[...Array(3)].map((_, index) => (
              <SkeletonLoader key={index} style={styles.skeletonTab} />
            ))}
          </View>
          <View style={styles.profileSkeletonGrid}>
            {[...Array(6)].map((_, index) => (
              <SkeletonLoader key={index} style={styles.skeletonGridItem} />
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0c" />
      
      {/* Header fluide */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>◀️</Text>
        </TouchableOpacity>
        <Text style={styles.headerUsername}>@{userData?.username || 'username'}</Text>
        {isOwnProfile ? (
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <GlassIconBadge icon="↪" size={30} />
          </TouchableOpacity>
        ) : <View style={{ width: 24 }} />}
      </View>

      <FlatList
        data={getFilteredPosts()}
        keyExtractor={(item) => item.id}
        renderItem={renderGridItem}
        numColumns={3}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
        ListHeaderComponent={
          <View style={styles.profileHeaderContainer}>
            
            {/* 1. Zone Photo de couverture Panorama */}
            <View style={styles.coverWrapper}>
              <ImageBackground
                source={userData?.coverUrl ? { uri: userData.coverUrl } : require('../../assets/images/Post.jpg')}
                style={styles.coverBackground}
                resizeMode="cover"
              >
                <View style={styles.coverOverlay} />
                {isOwnProfile && (
                  <TouchableOpacity style={styles.changeCoverButton} onPress={handleUpdateCoverImage}>
                    <Text style={styles.changeCoverButtonText}>Modifier</Text>
                  </TouchableOpacity>
                )}
              </ImageBackground>

              {/* 2. Avatar ⭕️ superposé chevauchant la ligne du bas */}
              <View style={styles.avatarContainer}>
                <TouchableOpacity activeOpacity={0.9} onPress={() => setAvatarViewerVisible(true)}>
                  <Image source={{ uri: userData?.photoURL || 'https://via.placeholder.com/150' }} style={styles.avatar} />
                  {uploading && <View style={styles.avatarLoader}><ActivityIndicator size="small" color="#fff" /></View>}
                </TouchableOpacity>
                {isOwnProfile && !uploading && (
                  <TouchableOpacity style={styles.cameraBadge} onPress={handleUpdateProfilePicture}>
                    <GlassIconBadge icon="+" color="#ffffff" size={28} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* 3. Informations & Biographie */}
            <View style={styles.bioContainer}>
              <View style={styles.nameRow}>
                <Text style={styles.displayName}>{userData?.displayName || 'Nom d\'usage'}</Text>
                {userData?.isVerified && <Text style={styles.verifiedBadge}>⚡</Text>}
              </View>
              {userData?.region && <Text style={styles.regionText}>📍 {userData.region}</Text>}
              <Text style={styles.bioText}>{userData?.bio || "Aucune biographie pour le moment."}</Text>
            </View>

            {/* 4. Compteurs alignés : Post • Abonner • Abonnement • Likes */}
            <View style={styles.statsContainer}>
              <View style={styles.statBox}><Text style={styles.statNumber}>{userPosts.length}</Text><Text style={styles.statLabel}>Post</Text></View>
              <View style={styles.statBox}><Text style={styles.statNumber}>{userData?.followersCount || 0}</Text><Text style={styles.statLabel}>Abonner</Text></View>
              <View style={styles.statBox}><Text style={styles.statNumber}>{userData?.followingCount || 0}</Text><Text style={styles.statLabel}>Abonnement</Text></View>
              <View style={styles.statBox}><Text style={styles.statNumber}>{userData?.likesCount || 0}</Text><Text style={styles.statLabel}>Likes</Text></View>
            </View>

            {/* Boutons d'action rapides */}
            <View style={styles.actionRow}>
              {isOwnProfile ? (
                <TouchableOpacity style={styles.primaryButton} onPress={() => setBioModalVisible(true)} disabled={uploading}>
                  <Text style={styles.primaryButtonText}>Ajouter une description</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity style={[styles.primaryButton, { flex: 1, marginRight: 8 }]}><Text style={styles.primaryButtonText}>Suivre</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.primaryButton, { backgroundColor: '#141418', width: 50 }]} onPress={() => navigation.navigate('ChatListScreen')}><GlassIconBadge icon={<CommentGlyph color="#ffffff" />} size={30} /></TouchableOpacity>
                </>
              )}
            </View>

            {/* Avatar fullscreen viewer */}
            <Modal visible={isAvatarViewerVisible} transparent animationType="fade">
              <View style={styles.modalOverlay}>
                <TouchableOpacity style={styles.modalBackground} onPress={() => setAvatarViewerVisible(false)} />
                <View style={styles.modalContent}>
                  <TouchableOpacity style={styles.modalCloseButton} onPress={() => setAvatarViewerVisible(false)}>
                    <Text style={styles.modalCloseText}>✕</Text>
                  </TouchableOpacity>
                  <Image source={{ uri: userData?.photoURL || 'https://via.placeholder.com/150' }} style={styles.avatarPreview} />
                </View>
              </View>
            </Modal>

            <Modal visible={isBioModalVisible} transparent animationType="slide">
              <View style={styles.modalOverlay}>
                <TouchableOpacity style={styles.modalBackground} onPress={() => setBioModalVisible(false)} />
                <View style={styles.bioModalContent}>
                  <Text style={styles.modalTitle}>Ajouter une description</Text>
                  <TextInput
                    style={styles.bioInput}
                    placeholder="Décris-toi en quelques mots..."
                    placeholderTextColor="#8a8a9a"
                    value={bioDraft}
                    onChangeText={setBioDraft}
                    multiline
                    textAlignVertical="top"
                  />
                  <View style={styles.modalButtonsRow}>
                    <TouchableOpacity style={styles.modalButton} onPress={() => setBioModalVisible(false)}>
                      <Text style={styles.modalButtonText}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modalButton, styles.modalButtonPrimary]} onPress={handleSaveBio}>
                      <Text style={styles.modalButtonPrimaryText}>Enregistrer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

            {/* 5. Filtres sous forme d'onglets personnalisés */}
            <View style={styles.filterTabBar}>
              <TouchableOpacity style={[styles.tabButton, activeTab === 'posts' && styles.activeTabButton]} onPress={() => setActiveTab('posts')}>
                <GlassIconBadge icon="▦" color={activeTab === 'posts' ? '#ffffff' : '#8a8a9a'} size={34} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabButton, activeTab === 'liked' && styles.activeTabButton]} onPress={() => setActiveTab('liked')}>
                <GlassIconBadge icon="♥" color={activeTab === 'liked' ? '#ffffff' : '#8a8a9a'} size={34} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabButton, activeTab === 'pinned' && styles.activeTabButton]} onPress={() => setActiveTab('pinned')}>
                <GlassIconBadge icon="◆" color={activeTab === 'pinned' ? '#ffffff' : '#8a8a9a'} size={34} />
              </TouchableOpacity>
            </View>

          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0c' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#0a0a0c' },
  backButton: { padding: 4 },
  backIcon: { fontSize: 18, color: '#fff' },
  headerUsername: { color: '#fff', fontWeight: '800', fontSize: 16 },
  logoutButton: { padding: 4 },
  logoutIcon: { fontSize: 18 },
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0c' },
  profileHeaderContainer: { paddingTop: 8 },
  
  // Design de la structure Couverture + Avatar Superposé
  coverWrapper: { width: '100%', height: 180, position: 'relative', marginBottom: 55 },
  coverBackground: { width: '100%', height: '100%', overflow: 'hidden' },
  coverImage: {},
  coverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)' },
  changeCoverButton: { position: 'absolute', right: 12, top: 12, backgroundColor: 'rgba(0, 0, 0, 0.6)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12 },
  changeCoverButtonText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  
  avatarContainer: { position: 'absolute', bottom: -45, left: 16, width: 90, height: 90, zIndex: 10 },
  avatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#141418', borderWidth: 3, borderColor: '#0a0a0c' },
  avatarLoader: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.5)', borderRadius: 45, justifyContent: 'center', alignItems: 'center' },
  cameraBadge: { position: 'absolute', bottom: 2, right: 2, backgroundColor: '#a613c4', width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#0a0a0c' },
  cameraIcon: { fontSize: 11 },

  // Biographie & Localisation
  bioContainer: { paddingHorizontal: 16, marginTop: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  displayName: { color: '#f0f0f2', fontWeight: '700', fontSize: 18 },
  verifiedBadge: { color: '#a613c4', fontSize: 13, marginLeft: 4 },
  regionText: { color: '#8a8a9a', fontSize: 13, marginTop: 2, fontWeight: '600' },
  bioText: { color: '#c0c0c5', fontSize: 14, lineHeight: 19, marginTop: 6 },
  
  // Stats Ligne
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 16 },
  statBox: { alignItems: 'flex-start' },
  statNumber: { color: '#f0f0f2', fontSize: 16, fontWeight: 'bold' },
  statLabel: { color: '#6a6a7a', fontSize: 13, marginTop: 2 },
  
  actionRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 14 },
  primaryButton: { flex: 1, backgroundColor: '#a613c4', borderRadius: 10, height: 38, justifyContent: 'center', alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBackground: { ...StyleSheet.absoluteFillObject },
  modalContent: { width: '100%', maxWidth: 420, backgroundColor: '#0a0a0c', borderRadius: 24, overflow: 'hidden', alignItems: 'center', padding: 20 },
  modalCloseButton: { position: 'absolute', top: 16, right: 16, zIndex: 10, padding: 10 },
  modalCloseText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  avatarPreview: { width: '100%', height: 360, borderRadius: 20, backgroundColor: '#141418' },
  bioModalContent: { width: '100%', maxWidth: 420, backgroundColor: '#0a0a0c', borderRadius: 24, overflow: 'hidden', padding: 20 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 12 },
  bioInput: { backgroundColor: '#141418', borderRadius: 14, padding: 16, color: '#fff', minHeight: 140, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 16 },
  modalButtonsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  modalButton: { flex: 1, borderRadius: 12, backgroundColor: '#141418', paddingVertical: 12, alignItems: 'center', marginRight: 8 },
  modalButtonPrimary: { backgroundColor: '#a613c4' },
  modalButtonText: { color: '#fff', fontWeight: '700' },
  modalButtonPrimaryText: { color: '#fff', fontWeight: '800' },
  
  // Barre d'onglets des Filtres
  filterTabBar: { flexDirection: 'row', marginTop: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)' },
  tabButton: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  activeTabButton: { borderBottomWidth: 2, borderBottomColor: '#a613c4' },
  tabIcon: { fontSize: 18, opacity: 0.4 },
  activeTabIcon: { opacity: 1 },

  gridItem: { width: COLUMN_WIDTH, height: COLUMN_WIDTH, margin: 1, backgroundColor: '#141418' },
  gridImage: { width: '100%', height: '100%' },
  gridTextCard: { flex: 1, padding: 8, justifyContent: 'center', alignItems: 'center' },
  gridTextCardContent: { color: '#8a8a9a', fontSize: 11, textAlign: 'center' },
  profileSkeletonContainer: { flex: 1, backgroundColor: '#0a0a0c', paddingHorizontal: 16, paddingTop: 16 },
  skeletonCover: { width: '100%', height: 140, borderRadius: 20, marginBottom: 18, backgroundColor: '#141418' },
  profileSkeletonHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 18 },
  skeletonAvatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: '#141418' },
  profileSkeletonTextGroup: { flex: 1 },
  skeletonName: { width: '70%', height: 18, borderRadius: 10, marginBottom: 10, backgroundColor: '#141418' },
  skeletonSubline: { width: '40%', height: 14, borderRadius: 10, backgroundColor: '#141418' },
  skeletonStatsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  skeletonStat: { flex: 1, height: 54, borderRadius: 16, backgroundColor: '#141418', marginRight: 10 },
  profileSkeletonTabs: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  skeletonTab: { flex: 1, height: 36, borderRadius: 18, backgroundColor: '#141418', marginRight: 10 },
  profileSkeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  skeletonGridItem: { width: COLUMN_WIDTH, height: COLUMN_WIDTH, borderRadius: 16, marginBottom: 6, backgroundColor: '#141418' },
});