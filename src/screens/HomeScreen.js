import { Audio, InterruptionModeAndroid, InterruptionModeIOS, RecordingOptionsPresets } from 'expo-av';
import * as Clipboard from 'expo-clipboard';
import {
    addDoc,
    arrayRemove,
    arrayUnion,
    collection,
    deleteDoc,
    doc,
    getDoc,
    increment,
    onSnapshot,
    orderBy,
    query,
    setDoc,
    updateDoc,
    where
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Easing,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Share,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomDrawerContent from '../components/CustomDrawerContent';
import SkeletonLoader from '../components/SkeletonLoader';
import { requestLiveKitToken } from '../config/api';
import { cloudinaryConfig } from '../config/cloudinary';
import { auth, db } from '../config/firebase';

const toDateValue = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value === 'number') return new Date(value);
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  return null;
};

const isStoryVisible = (value) => {
  const createdAt = toDateValue(value);
  if (!createdAt) return false;
  return Date.now() - createdAt.getTime() <= 24 * 60 * 60 * 1000;
};

const formatRelativeTime = (value) => {
  const createdAt = toDateValue(value);
  if (!createdAt) return 'À l’instant';

  const diffMs = Date.now() - createdAt.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'À l’instant';
  if (diffMinutes < 60) return `il y a ${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `il y a ${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  return `il y a ${diffDays} j`;
};

export default function HomeScreen({ navigation }) {
  const currentUserId = auth.currentUser?.uid || null;
  const insets = useSafeAreaInsets();

  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [savedPostIds, setSavedPostIds] = useState([]);
  const [commentInputs, setCommentInputs] = useState({});
  const [commentsByPost, setCommentsByPost] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  const [activePost, setActivePost] = useState(null);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [modalComments, setModalComments] = useState([]);
  const [modalCommentInput, setModalCommentInput] = useState('');
  const [modalRecording, setModalRecording] = useState(null);
  const [modalRecordingDuration, setModalRecordingDuration] = useState(0);
  const [modalAudioUploading, setModalAudioUploading] = useState(false);
  const [playingCommentId, setPlayingCommentId] = useState(null);
  const [audioSound, setAudioSound] = useState(null);

  const commentsListenerRef = useRef(null);
  const modalRecordingInterval = useRef(null);

  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const createAnim = useRef(new Animated.Value(0)).current;
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const drawerAnim = useRef(new Animated.Value(-320)).current;

  const handleSearchSubmit = () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    navigation.navigate('SearchResults', { query: trimmed });
  };

  useEffect(() => {
    return () => {
      if (commentsListenerRef.current) {
        commentsListenerRef.current();
        commentsListenerRef.current = null;
      }
      if (modalRecordingInterval.current) {
        clearInterval(modalRecordingInterval.current);
        modalRecordingInterval.current = null;
      }
      if (audioSound) {
        audioSound.unloadAsync().catch(() => {});
      }
    };
  }, [audioSound]);

  const stopAudioPlayback = async () => {
    if (!audioSound) return;
    try {
      await audioSound.stopAsync();
      await audioSound.unloadAsync();
    } catch (error) {
      console.warn('Erreur arrêt lecture audio:', error);
    }
    setAudioSound(null);
    setPlayingCommentId(null);
  };

  const closeCommentsModal = () => {
    if (commentsListenerRef.current) {
      commentsListenerRef.current();
      commentsListenerRef.current = null;
    }
    stopAudioPlayback();
    setCommentModalVisible(false);
    setActivePost(null);
    setModalComments([]);
    setModalCommentInput('');
    setModalRecording(null);
    setModalRecordingDuration(0);
    setModalAudioUploading(false);
  };

  const openComments = (post) => {
    setActivePost(post);
    setCommentModalVisible(true);
    if (commentsListenerRef.current) {
      commentsListenerRef.current();
      commentsListenerRef.current = null;
    }
    const commentsRef = collection(db, 'posts', post.id, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'asc'));
    commentsListenerRef.current = onSnapshot(
      q,
      (snapshot) => {
        const list = [];
        snapshot.forEach((docSnap) => list.push({ id: docSnap.id, ...docSnap.data() }));
        setModalComments(list);
      },
      (error) => {
        console.warn('Commentaires realtime failed:', error?.message || error);
      }
    );
  };

  const uploadMediaToCloudinary = async (uri, resourceType = 'auto', fileName = 'upload_audio') => {
    try {
      const { cloudName, uploadPreset } = cloudinaryConfig;
      const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;
      const response = await fetch(uri);
      const blob = await response.blob();
      const data = new FormData();
      data.append('file', blob, fileName);
      data.append('upload_preset', uploadPreset);

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        body: data,
      });

      if (!uploadResponse.ok) {
        const text = await uploadResponse.text();
        throw new Error(text);
      }

      const json = await uploadResponse.json();
      return json.secure_url || json.url;
    } catch (error) {
      console.error('Erreur téléversement Cloudinary:', error);
      throw error;
    }
  };

  const submitComment = async (postId, { text, mediaType = 'text', mediaUrl = '' }) => {
    if (!auth.currentUser) {
      Alert.alert('Connexion requise', 'Tu dois être connecté pour commenter.');
      return null;
    }

    const payload = {
      authorId: auth.currentUser.uid,
      authorName: auth.currentUser.displayName || 'Meetly user',
      authorAvatar: auth.currentUser.photoURL || 'https://via.placeholder.com/150',
      text: text?.trim() || '',
      mediaType,
      mediaUrl,
      createdAt: new Date(),
    };

    const commentRef = await addDoc(collection(db, 'posts', postId, 'comments'), payload);
    const newComment = { id: commentRef.id, ...payload };

    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);
    const existing = postSnap.exists() ? postSnap.data().latestComments || [] : [];
    const updatedLatest = [newComment, ...existing].slice(0, 3);
    await updateDoc(postRef, {
      latestComments: updatedLatest,
      commentsCount: increment(1),
    });

    const postAuthorId = postSnap.exists() ? postSnap.data().authorId : null;
    if (postAuthorId && postAuthorId !== auth.currentUser.uid) {
      await addDoc(collection(db, 'notifications'), {
        recipientId: postAuthorId,
        title: 'Nouveau commentaire',
        message: `${currentUserProfile?.displayName || 'Quelqu’un'} a commenté votre publication.`,
        createdAt: new Date(),
      });
    }

    return newComment;
  };

  const handleAddComment = async (postId, text = null) => {
    const commentText = text !== null ? text : commentInputs[postId];
    if (!commentText || !commentText.trim()) return;

    try {
      await submitComment(postId, {
        text: commentText.trim(),
        mediaType: 'text',
      });
      if (text === null) {
        setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
      } else {
        setModalCommentInput('');
      }
    } catch (error) {
      console.error('Erreur ajout commentaire:', error);
    }
  };

  const startRecordingComment = async () => {
    if (!activePost) return;

    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'L’accès au micro est nécessaire pour enregistrer un commentaire vocal.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        shouldDuckAndroid: true,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        playsInSilentModeAndroid: true,
        staysActiveInBackground: false,
      });

      const recordingInstance = new Audio.Recording();
      await recordingInstance.prepareToRecordAsync(RecordingOptionsPresets.HIGH_QUALITY);
      await recordingInstance.startAsync();
      setModalRecording(recordingInstance);
      setModalRecordingDuration(0);
      modalRecordingInterval.current = setInterval(() => {
        setModalRecordingDuration((prev) => prev + 100);
      }, 100);
    } catch (error) {
      console.error('Erreur démarrage enregistrement vocal :', error);
      Alert.alert('Erreur', 'Impossible de démarrer l’enregistrement vocal.');
    }
  };

  const stopRecordingComment = async () => {
    if (!modalRecording || !activePost) return;

    try {
      await modalRecording.stopAndUnloadAsync();
      const uri = modalRecording.getURI();
      setModalRecording(null);
      if (modalRecordingInterval.current) {
        clearInterval(modalRecordingInterval.current);
        modalRecordingInterval.current = null;
        setModalRecordingDuration(0);
      }

      if (!uri) {
        throw new Error('Impossible de récupérer le fichier audio.');
      }

      setModalAudioUploading(true);
      const uploadedUrl = await uploadMediaToCloudinary(uri, 'auto', `comment_${activePost.id}_${Date.now()}.mp3`);
      await submitComment(activePost.id, {
        text: 'Note vocale',
        mediaType: 'audio',
        mediaUrl: uploadedUrl,
      });
    } catch (error) {
      console.error('Erreur arrêt enregistrement vocal :', error);
      Alert.alert('Erreur', 'Impossible d’envoyer le commentaire vocal.');
    } finally {
      setModalAudioUploading(false);
    }
  };

  const togglePlayComment = async (comment) => {
    if (!comment.mediaUrl) return;
    if (playingCommentId === comment.id) {
      await stopAudioPlayback();
      return;
    }

    try {
      await stopAudioPlayback();
      const sound = new Audio.Sound();
      await sound.loadAsync({ uri: comment.mediaUrl }, { shouldPlay: true });
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          stopAudioPlayback();
        }
      });
      setAudioSound(sound);
      setPlayingCommentId(comment.id);
    } catch (error) {
      console.error('Erreur lecture audio commentaire :', error);
      Alert.alert('Erreur audio', 'Impossible de lire la note vocale.');
    }
  };

  // Écoute de l'utilisateur et de ses favoris locaux
  useEffect(() => {
    if (!currentUserId) return;

    const savedQuery = query(
      collection(db, 'saved_posts'),
      where('userId', '==', currentUserId)
    );

    const unsubscribeSaved = onSnapshot(savedQuery, (snapshot) => {
      const ids = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.postId) ids.push(data.postId);
      });
      setSavedPostIds(ids);
    });

    const userDocRef = doc(db, 'users', currentUserId);
    const unsubscribeUser = onSnapshot(
      userDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCurrentUserProfile(data);
        }
      },
      (error) => {
        console.warn('User snapshot error, skipping realtime updates:', error?.message);
      }
    );

    return () => {
      unsubscribeUser();
      unsubscribeSaved();
    };
  }, [currentUserId]);

  // Récupération des posts et des stories (Realtime only)
  useEffect(() => {
    let unsubStories = null;
    let unsubPosts = null;

    try {
      const storiesRef = collection(db, 'stories');
      const storiesQ = query(storiesRef, orderBy('createdAt', 'desc'));
      unsubStories = onSnapshot(
        storiesQ,
        (snapshot) => {
          const list = [];
          snapshot.forEach((d) => {
            const data = d.data();
            if (data && isStoryVisible(data.createdAt)) {
              list.push({ id: d.id, ...data });
            }
          });
          setStories(list);
          setError(null);
        },
        (error) => {
          console.warn('Stories realtime failed:', error?.message);
          setError('Problème de connexion aux stories.');
        }
      );
    } catch (err) {
      console.warn('Stories listener setup failed:', err?.message);
      setError('Impossible d\'écouter les stories.');
    }

    try {
      const postsRef = collection(db, 'posts');
      const postsQ = query(postsRef, orderBy('createdAt', 'desc'));
      unsubPosts = onSnapshot(
        postsQ,
        (snapshot) => {
          const postsList = [];
          const commentsMap = {};
          snapshot.forEach((d) => {
            const data = d.data();
            // Exclure explicitement les posts marqués comme stories
            if (data && data.isStory) return;
            // Inclure les types de post habituels dans le fil principal
            if (data.type === 'text' || data.type === 'image' || data.type === 'video') postsList.push({ id: d.id, ...data });
          });

          // Use denormalized latestComments field on the post document if available.
          postsList.forEach((p) => {
            commentsMap[p.id] = Array.isArray(p.latestComments) ? p.latestComments.slice(0, 3) : [];
          });

          setCommentsByPost(commentsMap);
          setPosts(postsList);
          setLoading(false);
          setError(null);
        },
        (error) => {
          console.warn('Posts realtime failed:', error?.message);
          setError('Problème de connexion aux posts.');
        }
      );
    } catch (err) {
      console.warn('Posts listener setup failed:', err?.message);
      setError('Impossible d\'écouter les posts.');
    }

    return () => {
      if (unsubStories) unsubStories();
      if (unsubPosts) unsubPosts();
    };
  }, [reloadKey]);

  // Gestion des Likes
  const handleLike = async (post) => {
    if (!currentUserId) return;
    const postRef = doc(db, 'posts', post.id);
    const hasLiked = post.likedBy && post.likedBy.includes(currentUserId);
    try {
      if (hasLiked) {
        await updateDoc(postRef, {
          likedBy: arrayRemove(currentUserId),
          likesCount: Math.max(0, (post.likesCount || 1) - 1),
        });
      } else {
        await updateDoc(postRef, {
          likedBy: arrayUnion(currentUserId),
          likesCount: (post.likesCount || 0) + 1,
        });
        if (post.authorId && post.authorId !== currentUserId) {
          await addDoc(collection(db, 'notifications'), {
            recipientId: post.authorId,
            title: 'Nouveau like',
            message: `${currentUserProfile?.displayName || 'Quelqu’un'} a aimé votre publication.`,
            createdAt: new Date(),
          });
        }
      }
    } catch (error) {
      console.log('Erreur like:', error);
    }
  };

  // Sauvegarde des posts favoris
  const toggleSavePost = async (post) => {
    if (!currentUserId) {
      Alert.alert('Connexion requise', 'Connecte-toi pour enregistrer des publications.');
      return;
    }

    const saveRef = doc(db, 'saved_posts', `${currentUserId}_${post.id}`);

    try {
      const docSnap = await getDoc(saveRef);

      if (docSnap.exists()) {
        await deleteDoc(saveRef);
        Alert.alert('Favoris', 'Publication retirée de vos enregistrements.');
      } else {
        await setDoc(saveRef, {
          userId: currentUserId,
          postId: post.id,
          postAuthor: post.authorName || 'Meetly User',
          postCaption: post.caption || '',
          postMedia: post.mediaUrl || '',
          savedAt: new Date()
        });
        Alert.alert('Favoris', 'Publication enregistrée !');
      }
    } catch (error) {
      console.error('Erreur enregistrement post:', error);
      Alert.alert('Erreur', "L'opération a échoué.");
    }
  };

  const handleShare = async (item) => {
    try {
      await Share.share({
        message: item.caption
          ? `${item.caption}\nRegardez cette vidéo sur Meetly: https://meetly.app/posts/${item.id}`
          : `Regardez cette publication sur Meetly: https://meetly.app/posts/${item.id}`,
        url: item.mediaUrl || `https://meetly.app/posts/${item.id}`,
        title: `Voir ${item.type === 'video' ? 'la vidéo' : 'la publication'} de ${item.authorName || 'Meetly User'}`,
      });
    } catch (error) {
      console.error('Erreur de partage:', error);
    }
  };

  // Copier le lien
  const handleCopyPostLink = async (postId) => {
    try {
      const postLink = `https://meetly.app/posts/${postId}`;
      await Clipboard.setStringAsync(postLink);
      Alert.alert('Lien copié !', 'Le lien de la publication a été copié.');
    } catch (error) {
      console.error('Erreur lors de la copie du lien:', error);
    }
  };

  const renderPostItem = ({ item }) => {
    const isLiked = item.likedBy && item.likedBy.includes(currentUserId);
    const isSaved = savedPostIds.includes(item.id);
    return (
      <View style={styles.postContainer}>
        <View style={styles.postHeader}>
          <Image source={{ uri: item.authorAvatar || 'https://via.placeholder.com/150' }} style={styles.postAvatar} />
          <View style={styles.postHeaderInfo}>
            <Text style={styles.postAuthorName}>{item.authorName || 'Anonyme'}</Text>
            <Text style={styles.postTime}>{formatRelativeTime(item.createdAt)}</Text>
          </View>
          <TouchableOpacity style={styles.moreButton}>
            <Text style={styles.moreButtonText}>•••</Text>
          </TouchableOpacity>
        </View>
        {item.caption ? <Text style={styles.postCaption}>{item.caption}</Text> : null}
        {item.type === 'image' && item.mediaUrl ? (
          <Image source={{ uri: item.mediaUrl }} style={styles.postMedia} resizeMode="cover" />
        ) : null}

        {item.type === 'video' ? (
          <>
            <PanGestureHandler
              activeOffsetX={[-30, 30]}
              failOffsetY={[-20, 20]}
              onHandlerStateChange={({ nativeEvent }) => {
                if (nativeEvent.state === State.END && nativeEvent.translationX < -80) {
                  navigation.navigate('TikTokScreen', { startVideoId: item.id });
                }
              }}
            >
              <View style={[styles.postMedia, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}> 
                {item.thumbnailUrl ? (
                  <Image source={{ uri: item.thumbnailUrl }} style={styles.postMedia} resizeMode="cover" />
                ) : (
                  <Text style={{ color: '#fff' }}>Glissez vers la gauche pour le voir en plein écran</Text>
                )}
              </View>
            </PanGestureHandler>
            <TouchableOpacity
              style={styles.openVerticalFeedButton}
              onPress={() => navigation.navigate('TikTokScreen', { startVideoId: item.id })}
            >
              <Text style={styles.openVerticalFeedText}>Voir en mode vertical</Text>
            </TouchableOpacity>
          </>
        ) : null}
        <View style={styles.postActions}>
          <View style={styles.leftActions}>
            <TouchableOpacity style={styles.actionButton} onPress={() => handleLike(item)}>
              <Text style={[styles.actionIcon, { color: isLiked ? '#ff3b30' : '#fff' }]}>{isLiked ? '❤️' : '🤍'}</Text>
              <Text style={styles.actionText}>{item.likesCount || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => openComments(item)}>
              <Text style={styles.actionIcon}>💬</Text>
              <Text style={styles.actionText}>{(commentsByPost[item.id] || []).length}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => handleShare(item)}>
              <Text style={styles.actionIcon}>↪️</Text>
              <Text style={styles.actionText}>Partager</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => toggleSavePost(item)}>
            <Text style={[styles.actionIcon, { color: isSaved ? '#a613c4' : '#fff' }]}>{isSaved ? '🔖' : '🤍'}</Text>
          </TouchableOpacity>
        </View>
        {(commentsByPost[item.id] || []).length > 0 && (
          <View style={styles.commentsSection}>
            {(commentsByPost[item.id] || []).slice(0, 3).map((comment) => (
              <Text key={comment.id} style={styles.commentText}><Text style={styles.commentAuthor}>{comment.authorName}:</Text> {comment.text}</Text>
            ))}
          </View>
        )}
        <View style={styles.commentInputRow}>
          <TextInput
            style={styles.commentInput}
            placeholder="Ajouter un commentaire..."
            placeholderTextColor="#8a8a9a"
            value={commentInputs[item.id] || ''}
            onChangeText={(text) => setCommentInputs((prev) => ({ ...prev, [item.id]: text }))}
          />
          <TouchableOpacity style={styles.commentButton} onPress={() => handleAddComment(item.id)}>
            <Text style={styles.commentButtonText}>Envoyer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const toggleCreateMenu = () => {
    const to = showCreateMenu ? 0 : 1;
    setShowCreateMenu(!showCreateMenu);
    Animated.timing(createAnim, {
      toValue: to,
      duration: 260,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  const startLive = async () => {
    if (!auth.currentUser) {
      Alert.alert('Connexion requise', 'Tu dois être connecté pour démarrer un live.');
      return;
    }
    const roomName = `home_live_${auth.currentUser?.uid || 'guest'}`;
    try {
      const tokenResp = await requestLiveKitToken(roomName, auth.currentUser.uid || 'guest');
      const token = tokenResp?.token || tokenResp;
      if (!token) {
        Alert.alert('Impossible de démarrer', 'Le service Live n\'est pas configuré.');
        return;
      }
      navigation.navigate('LiveCallScreen', { room: roomName, mode: 'audio', token });
    } catch (err) {
      console.error('startLive failed', err);
      Alert.alert('Erreur', 'Impossible de démarrer le live.');
    }
  };

  const createMenuTranslate = createAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [80, 0],
  });

  const openDrawer = () => {
    setDrawerVisible(true);
    Animated.timing(drawerAnim, {
      toValue: 0,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  const closeDrawer = () => {
    Animated.timing(drawerAnim, {
      toValue: -320,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => setDrawerVisible(false));
  };

  const retryFetch = () => {
    setError(null);
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0c" />
      {error && (
        <View style={{ backgroundColor: '#3b0000', padding: 10, alignItems: 'center' }}>
          <Text style={{ color: '#fff' }}>{error}</Text>
          <TouchableOpacity onPress={retryFetch} style={{ marginTop: 8 }}>
            <Text style={{ color: '#a613c4', fontWeight: '700' }}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {drawerVisible ? (
        <View style={styles.drawerOverlay}>
          <TouchableOpacity style={styles.drawerBackdrop} activeOpacity={1} onPress={closeDrawer} />
          <Animated.View style={[styles.drawerPanel, { transform: [{ translateX: drawerAnim }] }]}>
            <CustomDrawerContent navigation={navigation} onClose={closeDrawer} />
          </Animated.View>
        </View>
      ) : null}

      <View style={styles.appHeader}>
        <TouchableOpacity style={styles.headerMenuButton} onPress={openDrawer}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>

        <Text style={styles.logoText}>MEETLY</Text>

        <TouchableOpacity
          style={styles.profileHeaderButton}
          onPress={() => navigation.navigate('ProfileScreen')}
        >
          <Image source={{ uri: currentUserProfile?.photoURL || 'https://via.placeholder.com/150' }} style={styles.headerProfileAvatar} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={[styles.centerLoading, { paddingBottom: 92 + insets.bottom }]}> 
          <SkeletonLoader style={styles.skeletonHeader} />
          <View style={styles.skeletonStoriesRow}>
            {[...Array(4)].map((_, index) => (
              <SkeletonLoader key={index} style={styles.skeletonStory} />
            ))}
          </View>
          <SkeletonLoader style={styles.skeletonLine} />
          {[...Array(3)].map((_, index) => (
            <SkeletonLoader key={index} style={styles.skeletonPost} />
          ))}
        </View>
      ) : (
        <>
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id}
            renderItem={renderPostItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scrollListPadding, { paddingBottom: 92 + insets.bottom }]}
            ListHeaderComponent={
              <View style={styles.headerExtension}>
                {/* ─── SECTION STORIES ─── */}
                <View style={styles.storiesSection}>
                  <Text style={styles.sectionTitle}>Stories</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.storiesListContent}
                  >
                    <TouchableOpacity
                      style={styles.addStoryCard}
                      onPress={() => navigation.navigate('StudioPostScreen', { type: 'story' })}
                    >
                      <View style={styles.addStoryCircle}>
                        <Text style={styles.addStoryPlus}>+</Text>
                      </View>
                      <Text style={styles.storyUsername} numberOfLines={1}>Ajouter</Text>
                    </TouchableOpacity>

                    {stories.map((story, idx) => (
                      <TouchableOpacity key={story.id} style={styles.storyCard} onPress={() => navigation.navigate('StoryViewer', { startIndex: idx })}>
                        <View style={styles.storyImageContainer}>
                          <Image
                            source={{ uri: story.authorAvatar || 'https://via.placeholder.com/150' }}
                            style={styles.storyAvatar}
                          />
                        </View>
                        <Text style={styles.storyUsername} numberOfLines={1}>
                          {story.authorName ? story.authorName.split(' ')[0] : 'User'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* ─── BARRE DE RECHERCHE ─── */}
                <View style={styles.searchBarContainer}>
                  <Text style={styles.searchIcon}>🔍</Text>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Rechercher une personne, vidéo ou hashtag..."
                    placeholderTextColor="#8a8a9a"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    returnKeyType="search"
                    onSubmitEditing={handleSearchSubmit}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <Text style={styles.clearSearchIcon}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            }
          />

          {/* Commentaire modal half screen */}
          <Modal visible={commentModalVisible} transparent animationType="slide">
            <View style={styles.commentModalOverlay}>
              <TouchableOpacity style={styles.commentModalBackdrop} activeOpacity={1} onPress={closeCommentsModal} />
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.commentModalSheet}
              >
                <View style={styles.commentModalHandle} />
                <View style={styles.commentModalHeader}>
                  <Text style={styles.commentModalTitle}>Commentaires</Text>
                  <TouchableOpacity onPress={closeCommentsModal} style={styles.commentModalCloseButton}>
                    <Text style={styles.commentModalClose}>✕</Text>
                  </TouchableOpacity>
                </View>
                {activePost ? (
                  <Text style={styles.commentModalSubtitle}>Publication de {activePost.authorName || 'Anonyme'}</Text>
                ) : null}
                {modalComments.length === 0 ? (
                  <View style={styles.commentEmpty}>
                    <Text style={styles.commentEmptyText}>Aucun commentaire pour l’instant.</Text>
                  </View>
                ) : (
                  <FlatList
                    data={modalComments}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                      <View style={styles.commentModalItem}>
                        <Text style={styles.commentModalAuthor}>{item.authorName || 'Anonyme'}</Text>
                        {item.mediaType === 'audio' ? (
                          <TouchableOpacity onPress={() => togglePlayComment(item)}>
                            <Text style={styles.commentModalText}>{playingCommentId === item.id ? '⏸️ Pause note vocale' : '🔊 Écouter note vocale'}</Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={styles.commentModalText}>{item.text}</Text>
                        )}
                      </View>
                    )}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.commentModalList}
                  />
                )}
                <View style={styles.commentModalInputRow}>
                  <TouchableOpacity
                    style={[styles.voiceButton, modalRecording ? styles.voiceButtonRecording : null]}
                    onPress={async () => {
                      if (modalRecording) {
                        await stopRecordingComment();
                      } else {
                        await startRecordingComment();
                      }
                    }}
                  >
                    <Text style={styles.voiceButtonText}>{modalRecording ? '⏹️' : '🎙️'}</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.commentModalInput}
                    placeholder="Écrire un commentaire..."
                    placeholderTextColor="#8a8a9a"
                    value={modalCommentInput}
                    onChangeText={setModalCommentInput}
                  />
                  <TouchableOpacity
                    style={styles.commentButton}
                    onPress={() => handleAddComment(activePost?.id, modalCommentInput)}
                    disabled={modalAudioUploading}
                  >
                    <Text style={styles.commentButtonText}>{modalAudioUploading ? 'Envoi...' : 'Envoyer'}</Text>
                  </TouchableOpacity>
                </View>
                {modalRecording ? (
                  <Text style={styles.commentModalStatus}>Enregistrement : {Math.floor(modalRecordingDuration / 1000)}s</Text>
                ) : null}
              </KeyboardAvoidingView>
            </View>
          </Modal>

          {/* Boutons d'options d'ajouts */}
          <Animated.View style={[styles.createMenuContainer, { transform: [{ translateY: createMenuTranslate }] }]}> 
            {showCreateMenu && (
              <View style={styles.createMenuInner}>
                <TouchableOpacity style={styles.createOption} onPress={() => navigation.navigate('StudioPostScreen', { type: 'image' })}>
                  <Text style={styles.createEmoji}>🖼️</Text>
                  <Text style={styles.createLabel}>Image</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.createOption} onPress={() => navigation.navigate('StudioPostScreen', { type: 'video' })}>
                  <Text style={styles.createEmoji}>🎥</Text>
                  <Text style={styles.createLabel}>Vidéo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.createOption} onPress={() => navigation.navigate('StudioPostScreen', { type: 'text' })}>
                  <Text style={styles.createEmoji}>✍️</Text>
                  <Text style={styles.createLabel}>Texte</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.createOption} onPress={() => startLive()}>
                  <Text style={styles.createEmoji}>🔴</Text>
                  <Text style={styles.createLabel}>Live</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>

        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: '#0a0a0c',
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  skeletonHeader: {
    width: '70%',
    height: 16,
    borderRadius: 10,
    marginBottom: 16,
    backgroundColor: '#141418',
  },
  skeletonStoriesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 18,
    paddingHorizontal: 16,
  },
  skeletonStory: {
    width: 72,
    height: 92,
    borderRadius: 18,
    backgroundColor: '#141418',
  },
  skeletonLine: {
    width: '90%',
    height: 14,
    borderRadius: 10,
    marginBottom: 20,
    alignSelf: 'center',
    backgroundColor: '#141418',
  },
  skeletonPost: {
    width: '90%',
    height: 180,
    borderRadius: 22,
    marginBottom: 16,
    alignSelf: 'center',
    backgroundColor: '#141418',
  },
  headerMenuButton: {
    padding: 4,
  },
  menuIcon: {
    fontSize: 22,
    color: '#fff',
  },
  logoText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1.5,
  },
  profileHeaderButton: {
    padding: 2,
  },
  headerProfileAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#a613c4',
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storiesContainer: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 8,
  },
  storyCard: {
    alignItems: 'center',
    marginRight: 16,
  },
  storyImageContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: '#a613c4',
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#141418',
  },
  storyUsername: {
    color: '#8a8a9a',
    fontSize: 11,
    marginTop: 6,
    maxWidth: 68,
    textAlign: 'center',
  },
  postContainer: {
    backgroundColor: '#141418',
    marginBottom: 10,
    borderRadius: 16,
    marginHorizontal: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0a0a0c',
  },
  postHeaderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  postAuthorName: {
    color: '#f0f0f2',
    fontWeight: '700',
    fontSize: 14,
  },
  postTime: {
    color: '#6a6a7a',
    fontSize: 11,
    marginTop: 2,
  },
  moreButton: {
    padding: 4,
  },
  moreButtonText: {
    color: '#6a6a7a',
    fontSize: 14,
  },
  postCaption: {
    color: '#f0f0f2',
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  postMedia: {
    width: '100%',
    height: 300,
    backgroundColor: '#0a0a0c',
    marginBottom: 12,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 4,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  actionIcon: {
    fontSize: 18,
  },
  actionText: {
    color: '#8a8a9a',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  commentsSection: {
    paddingHorizontal: 14,
    marginTop: 8,
  },
  commentText: {
    color: '#c6c6ce',
    fontSize: 12,
    marginBottom: 4,
  },
  commentAuthor: {
    color: '#fff',
    fontWeight: '700',
  },
  commentInputRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    marginTop: 10,
    gap: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#0a0a0c',
    borderRadius: 10,
    color: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  commentButton: {
    backgroundColor: '#a613c4',
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  commentButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollListPadding: {
    paddingBottom: 90,
  },
  drawerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    flexDirection: 'row',
  },
  drawerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  drawerPanel: {
    width: 300,
    height: '100%',
    backgroundColor: '#0a0a0c',
  },
  bottomTabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(10, 10, 12, 0.85)',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingBottom: 25, 
    paddingTop: 14,
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'transparent'
  },
  tabIcon: {
    fontSize: 24,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  tabIconActive: {
    fontSize: 24,
    color: '#ffffff',
  },
  tabLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '500',
  },
  tabItemPlus: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#a613c4',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#a613c4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  plusIconText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '600',
    marginTop: -2,
  },
  createMenuContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 80,
    alignItems: 'center',
    pointerEvents: 'box-none',
    zIndex: 100,
  },
  createMenuInner: {
    backgroundColor: 'rgba(20, 20, 24, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  createOption: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 68,
  },
  createEmoji: {
    fontSize: 22,
  },
  createLabel: {
    fontSize: 11,
    color: '#fff',
    marginTop: 6,
  },
  commentModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  commentModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  commentModalSheet: {
    backgroundColor: '#141418',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    maxHeight: '62%',
    minHeight: '52%',
  },
  commentModalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#6a6a7a',
    alignSelf: 'center',
    marginBottom: 10,
  },
  commentModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  commentModalTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  commentModalCloseButton: {
    padding: 8,
  },
  commentModalClose: {
    color: '#fff',
    fontSize: 18,
  },
  commentModalSubtitle: {
    color: '#8a8a9a',
    fontSize: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  commentModalList: {
    paddingHorizontal: 0,
    paddingBottom: 10,
  },
  commentModalItem: {
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  commentModalAuthor: {
    color: '#fff',
    fontWeight: '700',
    marginBottom: 4,
    fontSize: 13,
  },
  commentModalText: {
    color: '#c6c6ce',
    fontSize: 13,
    lineHeight: 18,
  },
  commentEmpty: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: 'center',
  },
  commentEmptyText: {
    color: '#8a8a9a',
    fontSize: 13,
  },
  commentModalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  commentModalInput: {
    flex: 1,
    backgroundColor: '#0a0a0c',
    borderRadius: 14,
    color: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 10,
    fontSize: 13,
    maxHeight: 100,
  },
  commentModalStatus: {
    color: '#8a8a9a',
    fontSize: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  voiceButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#27272f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceButtonRecording: {
    backgroundColor: '#c4295a',
  },
  voiceButtonText: {
    fontSize: 18,
  },
  headerExtension: {
    backgroundColor: '#0a0a0c',
    paddingBottom: 10,
  },
  storiesSection: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  sectionTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 16,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  storiesListContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  addStoryCard: {
    alignItems: 'center',
    marginRight: 14,
    width: 65,
  },
  addStoryCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#141418',
    borderWidth: 2,
    borderColor: '#a613c4',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  addStoryPlus: {
    color: '#a613c4',
    fontSize: 22,
    fontWeight: 'bold',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141418',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 6,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    height: '100%',
  },
  clearSearchIcon: {
    color: '#8a8a9a',
    fontSize: 16,
    padding: 4,
  },
  searchFilterBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#141418',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  filterChipActive: {
    backgroundColor: '#a613c4',
    borderColor: '#a613c4',
  },
  filterChipText: {
    color: '#c8c8d0',
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  searchResultsContainer: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  searchResultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  backToFeedButton: {
    paddingVertical: 6,
  },
  backToFeedText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  searchResultsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  searchResultsList: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 120,
  },
  emptySearchState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  emptySearchText: {
    color: '#8a8a9a',
    fontSize: 14,
    textAlign: 'center',
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141418',
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  searchResultAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0a0a0c',
  },
  searchResultHashtagBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#2b1234',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultHashtagText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  searchResultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  searchResultTitle: {
    color: '#f0f0f2',
    fontWeight: '700',
    fontSize: 14,
  },
  searchResultSubtitle: {
    color: '#8a8a9a',
    fontSize: 12,
    marginTop: 2,
  },
  searchResultAction: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#a613c4',
  },
  searchResultActionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
});