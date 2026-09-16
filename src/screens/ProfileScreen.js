import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    ImageBackground,
    Modal,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import SkeletonLoader from '../components/SkeletonLoader';
import { getAvatarUri } from '../constants/assets';
import { useThemeStyles } from '../constants/themeStyles';
import { supabase } from '../lib/supabase';
import { appCache, CACHE_KEYS, CACHE_TTL } from '../utils/cache';
import { uploadToCloudinary } from '../utils/cloudinaryUpload';
import {
  BackIcon,
  LogoutIcon,
  CameraIcon,
  EditIcon,
  GridIcon,
  HeartIcon,
  PinIcon,
  MessagesIcon,
  UserPlusIcon,
  UserCheckIcon,
  VerifiedIcon,
  CloseIcon,
} from '../components/icons';

export default function ProfileScreen() {
  const themeStyles = useThemeStyles();
  const navigation = useNavigation();
  const route = useRoute();
  const { width } = useWindowDimensions();
  const COLUMN_WIDTH = Math.max(80, Math.floor(Math.min(width, 768) / 3) - 2);
  const insets = useSafeAreaInsets();

  const [sessionUser, setSessionUser] = useState(null);
  const userId = route.params?.userId || sessionUser?.id;
  const isOwnProfile = !!(sessionUser && userId === sessionUser.id);

  const [userData, setUserData] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isAvatarViewerVisible, setAvatarViewerVisible] = useState(false);
  const [isBioModalVisible, setBioModalVisible] = useState(false);
  const [bioDraft, setBioDraft] = useState('');
  const [activeTab, setActiveTab] = useState('posts');

  // Compteurs dynamiques
  const [totalLikes, setTotalLikes] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Charger l'utilisateur connecté
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSessionUser(data.user || null));
  }, []);

  // Charger le profil complet + posts + abonnements
  const loadProfile = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const profileCacheKey = CACHE_KEYS.profile(userId);
    const postsCacheKey = CACHE_KEYS.posts(userId);
    const cachedProfile = appCache.get(profileCacheKey);
    const cachedPosts = appCache.get(postsCacheKey);
    const [profileResult, postsResult, followersResult, followingResult] = await Promise.all([
      cachedProfile
        ? Promise.resolve({ data: cachedProfile, error: null })
        : supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      cachedPosts
        ? Promise.resolve({ data: cachedPosts, error: null })
        : supabase
          .from('posts')
          .select('id, type, caption, media_url, liked_by, is_pinned, created_at, likes_count')
          .eq('author_id', userId)
          .in('type', ['text', 'image'])
          .order('created_at', { ascending: false }),
      supabase.from('follows').select('id', { count: 'exact' }).eq('following_id', userId),
      supabase.from('follows').select('id', { count: 'exact' }).eq('follower_id', userId),
    ]);

    if (profileResult.error) {
      console.error('Erreur profil:', profileResult.error.message);
      setLoading(false);
      return;
    }

    const profile = profileResult.data;
    if (!cachedProfile && profile) appCache.set(profileCacheKey, profile, CACHE_TTL.profile);
    setUserData(
      profile
        ? {
            ...profile,
            displayName: profile.name,
            username: profile.username?.replace(/^@/, ''),
            phoneNumber: profile.phone_number,
            photoURL: profile.avatar_url,
            coverUrl: profile.cover_url,
          }
        : null
    );

    const posts = (postsResult.data || []).map((post) => ({
      ...post,
      authorId: post.author_id,
      mediaUrl: post.media_url,
      likedBy: post.liked_by,
      isPinned: post.is_pinned,
      likesCount: post.likes_count || 0,
    }));
    if (!cachedPosts) appCache.set(postsCacheKey, postsResult.data || [], CACHE_TTL.posts);
    setUserPosts(posts);

    // Calcul des likes total depuis les posts
    const computed = posts.reduce((sum, p) => sum + (p.likesCount || 0), 0);
    setTotalLikes(computed);

    // Compteurs abonnés / abonnements depuis table follows
    setFollowersCount(followersResult.count || 0);
    setFollowingCount(followingResult.count || 0);

    setLoading(false);
  }, [userId]);

  // Vérifier si l'utilisateur courant suit ce profil
  const checkFollowStatus = useCallback(async () => {
    if (!sessionUser?.id || !userId || isOwnProfile) return;
    const { data } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', sessionUser.id)
      .eq('following_id', userId)
      .maybeSingle();
    setIsFollowing(!!data);
  }, [sessionUser?.id, userId, isOwnProfile]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
      checkFollowStatus();
    }, [loadProfile, checkFollowStatus])
  );

  // Abonnement Realtime pour les likes sur les posts
  useEffect(() => {
    if (!userId) return;
    let active = true;
    const channel = supabase
      .channel(`profile-posts-${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'posts', filter: `author_id=eq.${userId}` },
        (payload) => {
          if (!active) return;
          setUserPosts((prev) => {
            const updated = prev.map((p) =>
              p.id === payload.new.id
                ? { ...p, likesCount: payload.new.likes_count || 0, likedBy: payload.new.liked_by }
                : p
            );
            setTotalLikes(updated.reduce((sum, p) => sum + (p.likesCount || 0), 0));
            return updated;
          });
        }
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Abonnement Realtime pour les abonnés
  useEffect(() => {
    if (!userId) return;
    let active = true;
    const channel = supabase
      .channel(`profile-follows-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follows', filter: `following_id=eq.${userId}` },
        async () => {
          if (!active) return;
          const { count } = await supabase
            .from('follows')
            .select('id', { count: 'exact' })
            .eq('following_id', userId);
          setFollowersCount(count || 0);
        }
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    setBioDraft(userData?.bio || '');
  }, [userData]);

  // --- Actions ---

  const handleFollow = async () => {
    if (!sessionUser?.id || !userId || isOwnProfile || followLoading) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', sessionUser.id)
          .eq('following_id', userId);
        setIsFollowing(false);
        setFollowersCount((c) => Math.max(0, c - 1));
      } else {
        await supabase
          .from('follows')
          .insert({ follower_id: sessionUser.id, following_id: userId });
        setIsFollowing(true);
        setFollowersCount((c) => c + 1);
        // Créer une notification pour la personne suivie
        await supabase.from('notifications').insert({
          recipient_id: userId,
          sender_id: sessionUser.id,
          type: 'follow',
          message: 'a commencé à te suivre.',
        });
      }
    } catch (err) {
      console.error('Erreur follow:', err);
      Alert.alert('Erreur', "L'opération a échoué.");
    } finally {
      setFollowLoading(false);
    }
  };

  const handleUpdateProfilePicture = async () => {
    if (!isOwnProfile) return;
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission requise', "L'accès aux photos est nécessaire.");
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
    if (!permissionResult.granted) {
      Alert.alert('Permission requise', "L'accès aux photos est nécessaire.");
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
      Alert.alert('Connexion requise', 'Reconnecte-toi avant de modifier ton profil.');
      return;
    }
    setUploading(true);
    try {
      const fileName = `${field === 'coverUrl' ? 'cover' : 'avatar'}_${sessionUser.id}_${Date.now()}.jpg`;
      const secureUrl = await uploadToCloudinary(localUri, { resourceType: 'image', fileName });
      if (!secureUrl) throw new Error('Cloudinary : URL manquante.');
      const updateData = {};
      if (field === 'coverUrl') {
        updateData.cover_url = secureUrl;
      } else {
        updateData.avatar_url = secureUrl;
        await supabase.auth.updateUser({ data: { avatar_url: secureUrl } });
      }
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: sessionUser.id, ...updateData }, { onConflict: 'id' });
      if (error) throw error;
      const { data: refreshedProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sessionUser.id)
        .maybeSingle();
      const nextProfile = refreshedProfile || { ...userData, ...updateData };
      setUserData({
        ...nextProfile,
        displayName: nextProfile.name,
        username: nextProfile.username?.replace(/^@/, ''),
        photoURL: nextProfile.avatar_url,
        coverUrl: nextProfile.cover_url,
      });
      Alert.alert(
        'Succès',
        field === 'coverUrl' ? 'Couverture mise à jour !' : 'Photo de profil mise à jour !'
      );
    } catch (error) {
      console.error('Erreur téléversement profil:', error);
      Alert.alert('Erreur', error.message || 'Le téléversement a échoué.');
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => supabase.auth.signOut().catch(console.error);

  const handleSaveBio = async () => {
    if (!isOwnProfile) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: sessionUser.id, bio: bioDraft }, { onConflict: 'id' });
      if (error) throw error;
      setUserData((prev) => ({ ...prev, bio: bioDraft }));
      setBioModalVisible(false);
      Alert.alert('Profil', 'Description mise à jour.');
    } catch (error) {
      Alert.alert('Erreur', "Impossible de mettre à jour ta description.");
    }
  };

  const getFilteredPosts = () => {
    if (activeTab === 'liked') {
      return userPosts.filter((post) => post.likedBy?.includes(sessionUser?.id));
    }
    if (activeTab === 'pinned') {
      return userPosts.filter((post) => post.isPinned === true);
    }
    return userPosts;
  };

  const handleOpenPost = (post) => {
    // Navigue vers le HomeScreen avec le post ouvert ou un écran PostDetail si disponible
    navigation.navigate('HomeScreen', { highlightPostId: post.id });
  };

  const renderGridItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.gridItem, { width: COLUMN_WIDTH, height: COLUMN_WIDTH }]}
      onPress={() => handleOpenPost(item)}
      activeOpacity={0.85}
    >
      {item.type === 'image' && item.mediaUrl ? (
        <Image source={{ uri: item.mediaUrl }} style={styles.gridImage} />
      ) : (
        <View style={styles.gridTextCard}>
          <Text style={styles.gridTextCardContent} numberOfLines={3}>
            {item.caption}
          </Text>
        </View>
      )}
      {/* Overlay compteur likes */}
      {item.likesCount > 0 && (
        <View style={styles.gridLikeBadge}>
          <Text style={styles.gridLikeText}>♥ {item.likesCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const formatCount = (n) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  };

  // --- Skeleton ---
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, themeStyles.screen]}>
        <StatusBar barStyle={themeStyles.statusBar} backgroundColor={themeStyles.theme.background} />
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
            {[...Array(4)].map((_, i) => (
              <SkeletonLoader key={i} style={styles.skeletonStat} />
            ))}
          </View>
          <View style={styles.profileSkeletonTabs}>
            {[...Array(3)].map((_, i) => (
              <SkeletonLoader key={i} style={styles.skeletonTab} />
            ))}
          </View>
          <View style={styles.profileSkeletonGrid}>
            {[...Array(6)].map((_, i) => (
              <SkeletonLoader
                key={i}
                style={[styles.skeletonGridItem, { width: COLUMN_WIDTH, height: COLUMN_WIDTH }]}
              />
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, themeStyles.screen]}>
      <StatusBar barStyle={themeStyles.statusBar} backgroundColor={themeStyles.theme.background} />

      {/* Header */}
      <View style={[styles.header, themeStyles.header]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <BackIcon size={22} color={themeStyles.theme?.text || '#ffffff'} />
        </TouchableOpacity>
        <Text style={[styles.headerUsername, themeStyles.text]}>
          @{userData?.username || 'username'}
        </Text>
        {isOwnProfile ? (
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <LogoutIcon size={18} color="#ff5c5c" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 30 }} />
        )}
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

            {/* Photo de couverture */}
            <View style={styles.coverWrapper}>
              <ImageBackground
                source={
                  userData?.coverUrl
                    ? { uri: userData.coverUrl }
                    : require('../../assets/images/Post.jpg')
                }
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

              {/* Avatar superposé */}
              <View style={styles.avatarContainer}>
                <TouchableOpacity activeOpacity={0.9} onPress={() => setAvatarViewerVisible(true)}>
                  <Image
                    source={{ uri: getAvatarUri(userData?.photoURL, userData?.displayName) }}
                    style={styles.avatar}
                  />
                  {uploading && (
                    <View style={styles.avatarLoader}>
                      <ActivityIndicator size="small" color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
                {isOwnProfile && !uploading && (
                  <TouchableOpacity style={styles.cameraBadge} onPress={handleUpdateProfilePicture}>
                    <CameraIcon size={16} color="#ffffff" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Nom & Bio */}
            <View style={styles.bioContainer}>
              <View style={styles.nameRow}>
                <Text style={[styles.displayName, themeStyles.text]}>
                  {userData?.displayName || "Nom d'usage"}
                </Text>
                {userData?.is_verified && (
                  <View style={styles.verifiedBadgeContainer}>
                    <VerifiedIcon size={16} color="#a613c4" />
                  </View>
                )}
              </View>
              {userData?.region && (
                <Text style={[styles.regionText, themeStyles.secondaryText]}>
                  📍 {userData.region}
                </Text>
              )}
              <Text style={[styles.bioText, themeStyles.secondaryText]}>
                {userData?.bio || 'Aucune biographie pour le moment.'}
              </Text>
            </View>

            {/* Statistiques calculées depuis les données du profil */}
            <View style={styles.statsContainer}>
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, themeStyles.text]}>{formatCount(userPosts.length)}</Text>
                <Text style={[styles.statLabel, themeStyles.mutedText]}>Publications</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, themeStyles.text]}>{formatCount(followersCount)}</Text>
                <Text style={[styles.statLabel, themeStyles.mutedText]}>Abonnés</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, themeStyles.text]}>{formatCount(followingCount)}</Text>
                <Text style={[styles.statLabel, themeStyles.mutedText]}>Abonnements</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, themeStyles.text]}>{formatCount(totalLikes)}</Text>
                <Text style={[styles.statLabel, themeStyles.mutedText]}>J’aime</Text>
              </View>
            </View>

            {/* Boutons d'action */}
            <View style={styles.actionRow}>
              {isOwnProfile ? (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => setBioModalVisible(true)}
                  disabled={uploading}
                >
                  <Text style={styles.primaryButtonText}>
                    {userData?.bio ? 'Modifier la description' : 'Ajouter une description'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      { flex: 1, marginRight: 8 },
                      isFollowing && styles.followingButton,
                    ]}
                    onPress={handleFollow}
                    disabled={followLoading}
                  >
                    {followLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <View style={styles.primaryButtonContent}>
                        {isFollowing ? (
                          <UserCheckIcon size={16} color="#ffffff" />
                        ) : (
                          <UserPlusIcon size={16} color="#ffffff" />
                        )}
                        <Text style={styles.primaryButtonText}>
                          {isFollowing ? 'Abonné' : 'Suivre'}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: '#141418', width: 50 }]}
                    onPress={() => navigation.navigate('ChatListScreen')}
                  >
                    <MessagesIcon size={20} color="#ffffff" />
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Modal avatar fullscreen */}
            <Modal visible={isAvatarViewerVisible} transparent animationType="fade">
              <View style={styles.modalOverlay}>
                <TouchableOpacity
                  style={styles.modalBackground}
                  onPress={() => setAvatarViewerVisible(false)}
                />
                <View style={styles.modalContent}>
                  <TouchableOpacity
                    style={styles.modalCloseButton}
                    onPress={() => setAvatarViewerVisible(false)}
                  >
                    <CloseIcon size={18} color="#ffffff" />
                  </TouchableOpacity>
                  <Image
                    source={{ uri: getAvatarUri(userData?.photoURL, userData?.displayName) }}
                    style={styles.avatarPreview}
                  />
                </View>
              </View>
            </Modal>

            {/* Modal bio */}
            <Modal visible={isBioModalVisible} transparent animationType="slide">
              <View style={styles.modalOverlay}>
                <TouchableOpacity
                  style={styles.modalBackground}
                  onPress={() => setBioModalVisible(false)}
                />
                <View style={styles.bioModalContent}>
                  <Text style={[styles.modalTitle, themeStyles.text]}>
                    {userData?.bio ? 'Modifier la description' : 'Ajouter une description'}
                  </Text>
                  <TextInput
                    style={[styles.bioInput, themeStyles.input]}
                    placeholder="Décris-toi en quelques mots..."
                    placeholderTextColor={themeStyles.theme?.textSecondary || '#8a8a9a'}
                    value={bioDraft}
                    onChangeText={setBioDraft}
                    multiline
                    textAlignVertical="top"
                    maxLength={200}
                  />
                  <Text style={styles.charCount}>{bioDraft.length}/200</Text>
                  <View style={styles.modalButtonsRow}>
                    <TouchableOpacity
                      style={styles.modalButton}
                      onPress={() => setBioModalVisible(false)}
                    >
                      <Text style={styles.modalButtonText}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalButtonPrimary]}
                      onPress={handleSaveBio}
                    >
                      <Text style={styles.modalButtonPrimaryText}>Enregistrer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

            {/* Onglets de filtres */}
            <View style={styles.filterTabBar}>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'posts' && styles.activeTabButton]}
                onPress={() => setActiveTab('posts')}
              >
                <GridIcon size={22} color={activeTab === 'posts' ? '#ffffff' : '#8a8a9a'} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'liked' && styles.activeTabButton]}
                onPress={() => setActiveTab('liked')}
              >
                <HeartIcon size={22} color={activeTab === 'liked' ? '#ffffff' : '#8a8a9a'} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'pinned' && styles.activeTabButton]}
                onPress={() => setActiveTab('pinned')}
              >
                <PinIcon size={22} color={activeTab === 'pinned' ? '#ffffff' : '#8a8a9a'} />
              </TouchableOpacity>
            </View>

          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyGrid}>
            <CameraIcon size={38} color="#8a8a9a" />
            <Text style={[styles.emptyGridText, themeStyles.mutedText]}>
              {activeTab === 'liked'
                ? 'Aucun post aimé'
                : activeTab === 'pinned'
                ? 'Aucun post épinglé'
                : 'Aucune publication'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0c' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#0a0a0c',
  },
  backButton: { padding: 4 },
  backIcon: { fontSize: 18, color: '#fff' },
  headerUsername: { color: '#fff', fontWeight: '800', fontSize: 16 },
  logoutButton: { padding: 4 },
  profileHeaderContainer: { paddingTop: 8 },

  // Cover + Avatar
  coverWrapper: { width: '100%', height: 180, position: 'relative', marginBottom: 55 },
  coverBackground: { width: '100%', height: '100%', overflow: 'hidden' },
  coverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)' },
  changeCoverButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  changeCoverButtonText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  avatarContainer: { position: 'absolute', bottom: -45, left: 16, width: 90, height: 90, zIndex: 10 },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#141418',
    borderWidth: 3,
    borderColor: '#0a0a0c',
  },
  avatarLoader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#a613c4',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#0a0a0c',
  },

  // Bio
  bioContainer: { paddingHorizontal: 16, marginTop: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  displayName: { color: '#f0f0f2', fontWeight: '700', fontSize: 18 },
  verifiedBadge: { color: '#a613c4', fontSize: 13, marginLeft: 4 },
  regionText: { color: '#8a8a9a', fontSize: 13, marginTop: 2, fontWeight: '600' },
  bioText: { color: '#c0c0c5', fontSize: 14, lineHeight: 19, marginTop: 6 },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 16,
  },
  statBox: { alignItems: 'flex-start', flex: 1 },
  statNumber: { color: '#f0f0f2', fontSize: 16, fontWeight: 'bold' },
  statLabel: { color: '#6a6a7a', fontSize: 12, marginTop: 2 },

  // Actions
  actionRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 14 },
  primaryButton: {
    flex: 1,
    backgroundColor: '#a613c4',
    borderRadius: 10,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  followingButton: { backgroundColor: '#2a2a35', borderWidth: 1, borderColor: '#a613c4' },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBackground: { ...StyleSheet.absoluteFillObject },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0a0a0c',
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    padding: 20,
  },
  modalCloseButton: { position: 'absolute', top: 16, right: 16, zIndex: 10, padding: 10 },
  modalCloseText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  avatarPreview: { width: '100%', height: 360, borderRadius: 20, backgroundColor: '#141418' },
  bioModalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#141418',
    borderRadius: 24,
    padding: 20,
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 12 },
  bioInput: {
    backgroundColor: '#0a0a0c',
    borderRadius: 14,
    padding: 16,
    color: '#fff',
    minHeight: 140,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 4,
  },
  charCount: { color: '#6a6a7a', fontSize: 11, textAlign: 'right', marginBottom: 12 },
  modalButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  modalButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#0a0a0c',
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalButtonPrimary: { backgroundColor: '#a613c4' },
  modalButtonText: { color: '#fff', fontWeight: '700' },
  modalButtonPrimaryText: { color: '#fff', fontWeight: '800' },

  // Tabs
  filterTabBar: {
    flexDirection: 'row',
    marginTop: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  tabButton: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  activeTabButton: { borderBottomWidth: 2, borderBottomColor: '#a613c4' },

  // Grid
  gridItem: { margin: 1, backgroundColor: '#141418', position: 'relative' },
  gridImage: { width: '100%', height: '100%' },
  gridTextCard: { flex: 1, padding: 8, justifyContent: 'center', alignItems: 'center' },
  gridTextCardContent: { color: '#8a8a9a', fontSize: 11, textAlign: 'center' },
  gridLikeBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  gridLikeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  emptyGrid: { alignItems: 'center', marginTop: 40, paddingHorizontal: 20 },
  emptyGridIcon: { fontSize: 40, marginBottom: 10 },
  emptyGridText: { fontSize: 14, color: '#8a8a9a', textAlign: 'center' },

  // Skeletons
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
  skeletonGridItem: { borderRadius: 16, marginBottom: 6, backgroundColor: '#141418' },
});