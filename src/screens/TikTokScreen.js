import { Asset } from 'expo-asset';
import { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    FlatList,
    Image,
    PanResponder,
    Share,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import GlassIconButton from '../components/GlassIconButton';
import CommentGlyph from '../components/CommentGlyph';
import Video from 'react-native-video'; // Composant vidéo natif ultra performant
import SkeletonLoader from '../components/SkeletonLoader';
import CommentsModal from '../components/CommentsModal';
import { supabase } from '../lib/supabase';

const { width, height } = Dimensions.get('window');

export default function TikTokScreen({ navigation, route }) {
  const startVideoId = route.params?.startVideoId || null;
  const [currentUserId, setCurrentUserId] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTrackIndex, setActiveTrackIndex] = useState(0);
  const [preloadUri, setPreloadUri] = useState(null);
  const [commentsPost, setCommentsPost] = useState(null);
  const flatListRef = useRef(null);
  const swipeResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > 100) navigation.replace('HomeScreen');
      },
    })
  ).current;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
  }, []);
  
  // Référence pour observer quelle vidéo est actuellement visible au centre de l'écran
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80 // La vidéo doit être visible à 80% pour se lancer
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setActiveTrackIndex(viewableItems[0].index);
    }
  }).current;

  useEffect(() => {
    let active = true;
    const loadVideos = async () => {
      const { data, error } = await supabase.from('posts').select('*').eq('type', 'video').order('created_at', { ascending: false });
      if (!active) return;
      if (error) {
        console.warn('Supabase videos failed:', error.message);
        setLoading(false);
        return;
      }
      const videoList = (data || []).map((item) => ({
        ...item,
        mediaUrl: item.media_url,
        authorName: item.author_name || 'Meetly user',
        likesCount: item.likes_count || 0,
        likedBy: Array.isArray(item.liked_by) ? item.liked_by : [],
      }));
      setVideos(videoList);
      setLoading(false);

      if (startVideoId && videoList.length > 0) {
        const idx = videoList.findIndex((v) => v.id === startVideoId);
        if (idx >= 0 && flatListRef.current) {
          setTimeout(() => {
            flatListRef.current.scrollToIndex({ index: idx, animated: true });
            setActiveTrackIndex(idx);
          }, 250);
        }
      }
    };
    loadVideos();
    const channel = supabase.channel('video-feed').on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, loadVideos).subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [startVideoId]);

  useEffect(() => {
    const nextIndex = activeTrackIndex + 1;
    const nextVideo = videos[nextIndex];
    setPreloadUri(nextVideo?.mediaUrl || null);
  }, [activeTrackIndex, videos]);

  useEffect(() => {
    if (!preloadUri) return;
    Asset.fromURI(preloadUri)
      .downloadAsync()
      .catch((error) => console.warn('Preload vidéo échoué', error));
  }, [preloadUri]);

  const [followingIds, setFollowingIds] = useState([]);
  const [heartBurst, setHeartBurst] = useState(null); // { id, x, y, animScale, animOpacity }
  const lastTapRef = useRef(0);

  useEffect(() => {
    if (!currentUserId) return;
    supabase.from('follows').select('following_id').eq('follower_id', currentUserId).then(({ data }) => {
      setFollowingIds((data || []).map((f) => f.following_id));
    });
  }, [currentUserId]);

  const handleFollowToggle = async (authorId) => {
    if (!currentUserId || !authorId || authorId === currentUserId) return;
    const isFollowing = followingIds.includes(authorId);
    if (isFollowing) {
      setFollowingIds((prev) => prev.filter((id) => id !== authorId));
      await supabase.from('follows').delete().eq('follower_id', currentUserId).eq('following_id', authorId);
    } else {
      setFollowingIds((prev) => [...prev, authorId]);
      await supabase.from('follows').insert({ follower_id: currentUserId, following_id: authorId });
    }
  };

  const triggerHeartAnimation = (x = width / 2 - 40, y = height / 2 - 40) => {
    const scale = new Animated.Value(0);
    const opacity = new Animated.Value(1);
    const id = Date.now();

    setHeartBurst({ id, x, y, scale, opacity });

    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1.4,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 800,
        delay: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setHeartBurst((prev) => (prev?.id === id ? null : prev));
    });
  };

  const handleDoubleTap = (item) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap detected
      triggerHeartAnimation();
      const currentLikedBy = Array.isArray(item.likedBy) ? item.likedBy : [];
      if (!currentLikedBy.includes(currentUserId)) {
        handleLike(item);
      }
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  const handleLike = async (item) => {
    if (!currentUserId) return;
    const currentLikedBy = Array.isArray(item.likedBy) ? item.likedBy : [];
    const hasLiked = currentLikedBy.includes(currentUserId);
    const newLikedBy = hasLiked
      ? currentLikedBy.filter((id) => id !== currentUserId)
      : [...currentLikedBy, currentUserId];
    const newLikesCount = Math.max(0, (item.likesCount || 0) + (hasLiked ? -1 : 1));

    // Optimistic UI update
    setVideos((items) =>
      items.map((v) =>
        v.id !== item.id
          ? v
          : { ...v, likedBy: newLikedBy, likesCount: newLikesCount }
      )
    );

    try {
      if (hasLiked) {
        await supabase.from('post_likes').delete().eq('post_id', item.id).eq('user_id', currentUserId);
      } else {
        await supabase.from('post_likes').insert({ post_id: item.id, user_id: currentUserId });
      }
    } catch (error) {
      console.warn('Erreur like video:', error);
    }
  };

  const handleShare = async (item) => {
    try {
      await Share.share({
        message: item.caption
          ? `${item.caption}\nRegardez cette vidéo sur Meetly: https://meetly.app/posts/${item.id}`
          : `Regardez cette vidéo sur Meetly: https://meetly.app/posts/${item.id}`,
        url: item.mediaUrl,
        title: `Voir la vidéo de ${item.authorName || 'Meetly User'}`,
      });
    } catch (error) {
      console.error('Erreur de partage:', error);
    }
  };

  // Composant pour chaque cellule vidéo plein écran
  const renderVideoItem = ({ item, index }) => {
    const isPaused = index !== activeTrackIndex;
    const isLiked = Array.isArray(item.likedBy) && item.likedBy.includes(currentUserId);
    const isAuthor = item.author_id === currentUserId;
    const isFollowing = followingIds.includes(item.author_id);

    return (
      <TouchableOpacity
        activeOpacity={1}
        style={styles.videoCard}
        onPress={() => handleDoubleTap(item)}
      >
        <Video
          source={{ uri: item.mediaUrl }}
          style={styles.fullVideo}
          resizeMode="cover"
          repeat={true}
          paused={isPaused}
          muted={false}
          playsInline
        />

        {/* Cœur géant animé lors du Double-Tap */}
        {heartBurst && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.floatingHeartContainer,
              {
                transform: [{ scale: heartBurst.scale }],
                opacity: heartBurst.opacity,
              },
            ]}
          >
            <Text style={styles.floatingHeartIcon}>💖</Text>
          </Animated.View>
        )}

        {/* Overlay d'informations de l'auteur (Bas gauche) */}
        <View style={styles.overlayContainer}>
          <Text style={styles.authorName}>@{item.authorName.replace(/\s+/g, '').toLowerCase()}</Text>
          {item.caption ? <Text style={styles.captionText}>{item.caption}</Text> : null}
          
          <View style={styles.musicRow}>
            <Text style={styles.musicIcon}>🎵</Text>
            <Text style={styles.musicText} numberOfLines={1}>
              Son d’origine - @{item.authorName.replace(/\s+/g, '').toLowerCase()}
            </Text>
          </View>
        </View>

        {/* Actions sociales verticales (Droite) */}
        <View style={styles.rightActionsContainer}>
          {/* Avatar avec bouton Follow */}
          <View style={styles.avatarWrapper}>
            <Image
              source={{ uri: item.author_avatar || 'https://via.placeholder.com/150' }}
              style={styles.authorAvatar}
            />
            {!isAuthor && !isFollowing && (
              <TouchableOpacity
                style={styles.followBadge}
                onPress={() => handleFollowToggle(item.author_id)}
              >
                <Text style={styles.followBadgeText}>+</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Like */}
          <GlassIconButton
            icon={isLiked ? '♥' : '♡'}
            label={String(item.likesCount || 0)}
            active={isLiked}
            style={styles.actionButton}
            onPress={() => handleLike(item)}
            accessibilityLabel={isLiked ? 'Retirer le j’aime' : 'Aimer la vidéo'}
          />

          <GlassIconButton
            icon={<CommentGlyph color="#ffffff" />}
            label={String(item.comments_count || 0)}
            style={styles.actionButton}
            onPress={() => setCommentsPost(item)}
            accessibilityLabel="Afficher les commentaires"
          />
          
          {/* Partager */}
          <GlassIconButton
            icon='↗'
            label="Partager"
            style={styles.actionButton}
            onPress={() => handleShare(item)}
            accessibilityLabel="Partager la vidéo"
          />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container} {...swipeResponder.panHandlers}>
      <View style={styles.homeButton}>
        <GlassIconButton icon="⌂" onPress={() => navigation.replace('HomeScreen')} accessibilityLabel="Retourner à l'accueil" />
      </View>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {loading ? (
        <View style={styles.centerLoading}>
          <SkeletonLoader style={styles.skeletonVideoLarge} />
          <SkeletonLoader style={styles.skeletonVideoLarge} />
        </View>
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(item) => item.id}
          renderItem={renderVideoItem}
          ref={flatListRef}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={height}
          snapToAlignment="start"
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
          initialNumToRender={2}
          maxToRenderPerBatch={3}
          windowSize={3}
          onScrollToIndexFailed={({ index }) => {
            if (flatListRef.current) {
              flatListRef.current.scrollToOffset({ offset: index * height, animated: true });
            }
          }}
        />
      )}
      {preloadUri ? (
        <View style={[styles.preloadContainer, { pointerEvents: 'none' }]}>
          <Video
            source={{ uri: preloadUri }}
            style={styles.preloadVideo}
            resizeMode="cover"
            muted
            repeat
            paused={false}
          />
        </View>
      ) : null}
      <CommentsModal
        visible={Boolean(commentsPost)}
        post={commentsPost}
        onClose={() => setCommentsPost(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // Noir pur TikTok
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skeletonVideoLarge: { width: width, height: height * 0.7, borderRadius: 24, backgroundColor: '#141418', marginBottom: 18 },
  videoCard: {
    width: width,
    height: height,
    position: 'relative',
  },
  fullVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
  overlayContainer: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 80,
    zIndex: 10,
  },
  authorName: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 6,
    textShadow: '1px 1px 3px rgba(0, 0, 0, 0.6)',
  },
  captionText: {
    color: '#e0e0e0',
    fontSize: 14,
    lineHeight: 18,
    textShadow: '1px 1px 3px rgba(0, 0, 0, 0.6)',
  },
  rightActionsContainer: {
    position: 'absolute',
    right: 12,
    bottom: 100,
    alignItems: 'center',
    zIndex: 10,
  },
  preloadContainer: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
  preloadVideo: {
    width: 1,
    height: 1,
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 20,
    width: 58,
  },
  homeButton: { position: 'absolute', top: 44, left: 16, zIndex: 20 },
  floatingHeartContainer: {
    position: 'absolute',
    top: height / 2 - 60,
    left: width / 2 - 50,
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingHeartIcon: {
    fontSize: 90,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 20,
    alignItems: 'center',
  },
  authorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  followBadge: {
    position: 'absolute',
    bottom: -8,
    backgroundColor: '#fe2c55',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followBadgeText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
    lineHeight: 18,
  },
  musicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  musicIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  musicText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
    maxWidth: '85%',
  },
});