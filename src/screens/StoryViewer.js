import { Video } from 'expo-av';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Image, PanResponder, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');
const DEFAULT_ADVANCE_MS = 5000;

export default function StoryViewer({ navigation, route }) {
  const startIndex = Number(route.params?.startIndex || 0);

  const [stories, setStories] = useState([]);
  const [index, setIndex] = useState(startIndex);
  const progress = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);
  const videoRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const [storyDurationMs, setStoryDurationMs] = useState(DEFAULT_ADVANCE_MS);
  const [comments, setComments] = useState([]);
  const commentsListenerRef = useRef(null);
  const [reactions, setReactions] = useState([]);

  const addReaction = async () => {
    if (!story) return;

    // create local animated reaction with separate animated values
    const id = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const left = 10 + Math.floor(Math.random() * 60); // offset from right
    const animY = new Animated.Value(0);
    const animX = new Animated.Value(0);
    const animOpacity = new Animated.Value(1);

    const newR = { id, left, animY, animX, opacity: animOpacity };
    setReactions((prev) => [...prev, newR]);

    // random horizontal drift between -30 and +30
    const drift = (Math.random() * 60) - 30;

    // animate up, drift horizontally and fade out
    Animated.parallel([
      Animated.timing(animY, { toValue: -220, duration: 1400 + Math.floor(Math.random() * 400), useNativeDriver: true }),
      Animated.timing(animX, { toValue: drift, duration: 1400 + Math.floor(Math.random() * 400), useNativeDriver: true }),
      Animated.timing(animOpacity, { toValue: 0, duration: 1400 + Math.floor(Math.random() * 400), useNativeDriver: true }),
    ]).start(() => {
      // cleanup
      setReactions((prev) => prev.filter((x) => x.id !== id));
    });

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { error } = await supabase.from('story_reactions').upsert({
        story_id: story.id,
        user_id: userData.user.id,
        reaction: 'heart',
      });
      if (error) throw error;
    } catch (e) {
      console.warn('Failed to persist reaction', e);
    }
  };

  useEffect(() => {
    const fetchStories = async () => {
      try {
        const { data, error } = await supabase.from('stories').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        const list = (data || []).map((story) => ({
          ...story,
          authorId: story.author_id,
          authorName: story.author_name,
          authorAvatar: story.author_avatar,
          mediaUrl: story.media_url,
          createdAt: story.created_at,
        }));
        setStories(list);
        if (startIndex < list.length) setIndex(startIndex);
      } catch (e) {
        console.error('Failed to load stories', e);
      }
    };
    fetchStories();
  }, []);

  useEffect(() => {
    // when index changes, update comments listener
    stopCommentsListener();
    const s = stories[index];
    if (s) {
      let active = true;
      const loadComments = async () => {
        const { data, error } = await supabase.from('story_comments').select('*').eq('story_id', s.id).order('created_at', { ascending: true });
        if (!active) return;
        if (error) {
          console.warn('Story comments listener error', error.message);
          return;
        }
        setComments((data || []).map((comment) => ({
          ...comment,
          authorName: comment.author_id,
          text: comment.body,
        })));
      };
      loadComments();
      const channel = supabase.channel(`story-comments-${s.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'story_comments', filter: `story_id=eq.${s.id}` }, loadComments).subscribe();
      commentsListenerRef.current = () => {
        active = false;
        supabase.removeChannel(channel);
      };
    }

    // start/stop progress
    startProgress();
    return () => {
      stopProgress();
      stopCommentsListener();
    };
  }, [index, stories, paused]);

  const stopCommentsListener = () => {
    if (commentsListenerRef.current) {
      try { commentsListenerRef.current(); } catch {};
      commentsListenerRef.current = null;
    }
  };

  const startProgress = async () => {
    // determine duration: if current story is video, use its duration; else default
    const s = stories[index];
    let duration = DEFAULT_ADVANCE_MS;
    if (s && s.type === 'video' && videoRef.current && videoRef.current.getStatusAsync) {
      try {
        const status = await videoRef.current.getStatusAsync();
        if (status && status.durationMillis) duration = Math.max(1000, Math.floor(status.durationMillis));
      } catch (e) {
        // ignore
      }
    }
    setStoryDurationMs(duration);

    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: duration,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !paused) goNext();
    });
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!paused) goNext();
    }, duration + 200);
  };

  const stopProgress = () => {
    try { Animated.timing(progress).stop(); } catch {}
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const goNext = () => {
    // animate transition
    fadeOutCurrent(() => {
      if (index < stories.length - 1) setIndex((i) => i + 1);
      else navigation.goBack();
    });
  };

  const goPrev = () => {
    fadeOutCurrent(() => {
      if (index > 0) setIndex((i) => i - 1);
      else navigation.goBack();
    });
  };

  // Transition animation
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const fadeOutCurrent = (cb) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      fadeAnim.setValue(1);
      cb && cb();
    });
  };

  const pan = useRef({ dy: 0 }).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 10,
      onPanResponderMove: (_, gesture) => { pan.dy = gesture.dy; },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 120) navigation.goBack();
      }
    })
  ).current;

  const story = stories[index];
  const progressWidth = progress.interpolate({ inputRange: [0, 1], outputRange: [0, width] });

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <StatusBar hidden />
      <View style={styles.progressBarContainer}>
        {stories.map((s, i) => (
          <View key={s.id} style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, i === index ? { width: progressWidth } : { width: i < index ? width : 0 }]} />
          </View>
        ))}
      </View>

      <Animated.View style={[styles.mediaArea, { opacity: fadeAnim }]}> 
        {story ? (
          story.type === 'image' || !story.mediaUrl ? (
            <Image source={{ uri: story.mediaUrl || story.authorAvatar }} style={styles.media} resizeMode="cover" />
          ) : (
            <Video
              ref={videoRef}
              source={{ uri: story.mediaUrl }}
              style={styles.media}
              resizeMode="cover"
              shouldPlay={!paused}
              isLooping={false}
              onPlaybackStatusUpdate={(status) => {
                if (status && status.durationMillis && !status.isLoaded) return;
                if (status && status.durationMillis) {
                  // if status hasn't been used to set duration, update
                  if (!storyDurationMs || storyDurationMs === DEFAULT_ADVANCE_MS) setStoryDurationMs(Math.max(1000, Math.floor(status.durationMillis)));
                }
                if (status && status.didJustFinish) {
                  goNext();
                }
              }}
            />
          )
        ) : (
          <View style={styles.empty}><Text style={{ color: '#fff' }}>Chargement...</Text></View>
        )}

        {/* Comments overlay: show latest comments as scrolling list */}
        <View style={[styles.commentsOverlay, { pointerEvents: 'none' }]}>
          {comments.slice(-5).map((c, i) => (
            <Animated.Text key={c.id} style={[styles.commentOverlayText, { bottom: 20 + i * 22 }]}>{c.authorName}: {c.text}</Animated.Text>
          ))}
        </View>

        {/* Reactions floating */}
        <View style={[styles.reactionsContainer, { pointerEvents: 'box-none' }]}>
          {reactions.map((r) => (
              <Animated.View key={r.id} style={[styles.reaction, { left: r.left, opacity: r.opacity, transform: [{ translateY: r.animY }, { translateX: r.animX }] }]}> 
                <Text style={{ fontSize: 22 }}>❤️</Text>
              </Animated.View>
            ))}
        </View>
      </Animated.View>

      <View style={[styles.controls, { pointerEvents: 'box-none' }]}>
        <TouchableOpacity style={styles.leftZone} onPress={goPrev} />
        <TouchableOpacity style={styles.centerZone} onPress={() => { setPaused((p) => !p); if (paused) startProgress(); else stopProgress(); }} />
        <TouchableOpacity style={styles.rightZone} onPress={goNext} />
      </View>

      <View style={styles.topBar}> 
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}><Text style={styles.closeText}>✕</Text></TouchableOpacity>
        <View style={styles.authorInfo}>
          <Text style={styles.authorName}>{story?.authorName || ''}</Text>
        </View>
        <TouchableOpacity onPress={() => addReaction()} style={styles.reactionButton}><Text style={{ color: '#fff' }}>💓</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  progressBarContainer: { position: 'absolute', top: 30, left: 12, right: 12, height: 4, flexDirection: 'row', zIndex: 50 },
  progressTrack: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', height: 4, marginHorizontal: 3, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: '#fff' },
  mediaArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  media: { width: '100%', height: '100%' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  controls: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row' },
  leftZone: { flex: 1 },
  centerZone: { flex: 1 },
  rightZone: { flex: 1 },
  topBar: { position: 'absolute', top: 36, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reactionButton: { padding: 8 },
  closeButton: { padding: 8 },
  closeText: { color: '#fff', fontSize: 20 },
  authorInfo: { marginLeft: 8 },
  authorName: { color: '#fff', fontWeight: '700' },
  commentsOverlay: { position: 'absolute', left: 12, right: 80, bottom: 20, zIndex: 60 },
  commentOverlayText: { color: '#fff', backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, position: 'absolute' },
  reactionsContainer: { position: 'absolute', right: 20, bottom: 80, top: 120, width: 80, zIndex: 70 },
  reaction: { position: 'absolute', right: 0 },
});
