import { Asset } from 'expo-asset';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Share,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Video from 'react-native-video'; // Composant vidéo natif ultra performant
import SkeletonLoader from '../components/SkeletonLoader';
import { db } from '../config/firebase';

const { width, height } = Dimensions.get('window');

export default function TikTokScreen({ route }) {
  const startVideoId = route.params?.startVideoId || null;
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTrackIndex, setActiveTrackIndex] = useState(0);
  const [preloadUri, setPreloadUri] = useState(null);
  const flatListRef = useRef(null);
  
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
    // Filtrage strict Point 23 : On ne récupère que le type "video"
    const postsRef = collection(db, "posts");
    const videoQuery = query(
      postsRef,
      where("type", "==", "video"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(videoQuery, (snapshot) => {
      const videoList = [];
      snapshot.forEach((doc) => {
        videoList.push({ id: doc.id, ...doc.data() });
      });
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
    });

    return () => unsubscribe();
  }, []);

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

    return (
      <View style={styles.videoCard}>
        <Video
          source={{ uri: item.mediaUrl }}
          style={styles.fullVideo}
          resizeMode="cover"
          repeat={true}
          paused={isPaused} // Ne joue la vidéo QUE si elle est active à l'écran
          muted={false}
          playsInline
          // TODO: Connecter ici un cache local (react-native-video-cache) pour éviter les rebuffering
          // TODO: Précharger la vidéo suivante (N+1) lorsque `index === activeTrackIndex` via un système de préfetch
        />

        {/* Overlay d'informations de l'auteur (Bas gauche) */}
        <View style={styles.overlayContainer}>
          <Text style={styles.authorName}>@{item.authorName.replace(/\s+/g, '').toLowerCase()}</Text>
          {item.caption ? <Text style={styles.captionText}>{item.caption}</Text> : null}
        </View>

        {/* Actions sociales verticales (Droite) */}
        <View style={styles.rightActionsContainer}>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionIcon}>❤️</Text>
            <Text style={styles.actionText}>{item.likesCount || 0}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={() => handleShare(item)}>
            <Text style={styles.actionIcon}>🔗</Text>
            <Text style={styles.actionText}>Partager</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
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
        <View style={styles.preloadContainer} pointerEvents="none">
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
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  captionText: {
    color: '#e0e0e0',
    fontSize: 14,
    lineHeight: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
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
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 10,  
    borderRadius: 30,
    width: 50,
    height: 50,
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 22,
  },
  actionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});