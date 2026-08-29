import { Audio, InterruptionModeAndroid, InterruptionModeIOS, RecordingOptionsPresets, Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import SkeletonLoader from '../components/SkeletonLoader';
import GlassIconButton from '../components/GlassIconButton';
import MicrophoneGlyph from '../components/MicrophoneGlyph';
import { requestLiveKitToken } from '../config/api';
import { supabase } from '../lib/supabase';
import { uploadToCloudinary } from '../utils/cloudinaryUpload';

const formatMessageTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function ChatScreen({ navigation, route }) {
  const { chatId, recipientId } = route.params || {};

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(null);
  const [audioSound, setAudioSound] = useState(null);
  const [playingMessageId, setPlayingMessageId] = useState(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [waveformHeights, setWaveformHeights] = useState([8, 12, 6, 14, 10, 16]);
  const [recordDuration, setRecordDuration] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);
  const [recipientProfile, setRecipientProfile] = useState(null);
  const [isRecipientTyping, setIsRecipientTyping] = useState(false);
  const [isRecipientOnline, setIsRecipientOnline] = useState(false);
  const flatListRef = useRef();
  const reconnectTimeout = useRef(null);
  const waveformInterval = useRef(null);
  const typingTimeoutRef = useRef(null);
  const broadcastChannelRef = useRef(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user || null));
  }, []);

  useEffect(() => {
    if (!recipientId) return;
    supabase.from('profiles').select('*').eq('id', recipientId).maybeSingle().then(({ data }) => {
      if (data) setRecipientProfile(data);
    });
  }, [recipientId]);

  useEffect(() => {
    if (!chatId || !currentUser) return;
    const channel = supabase.channel(`chat-events-${chatId}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload?.payload?.userId !== currentUser.id) {
          setIsRecipientTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            setIsRecipientTyping(false);
          }, 3000);
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const onlineUsers = Object.values(state).flat().map((p) => p.userId);
        setIsRecipientOnline(onlineUsers.includes(recipientId));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ userId: currentUser.id, onlineAt: new Date().toISOString() });
        }
      });

    broadcastChannelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [chatId, currentUser, recipientId]);

  useEffect(() => {
    if (!chatId) return undefined;
    let active = true;
    const loadMessages = async () => {
      const { data, error } = await supabase.from('messages').select('*').eq('conversation_id', chatId).is('deleted_at', null).order('created_at', { ascending: true });
      if (error) {
        console.error('Erreur flux messages :', error);
        setLoading(false);
        setIsReconnecting(true);
        return;
      }
      if (!active) return;
      const messagesList = (data || []).map((message) => ({
        ...message,
        senderId: message.sender_id,
        mediaType: message.media_type,
        mediaUrl: message.media_url,
        timestamp: message.created_at,
        text: message.body,
        readAt: message.read_at,
      }));
      setMessages(messagesList);
      setLoading(false);
      setIsReconnecting(false);
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }

      setTimeout(() => {
        if (flatListRef.current && messagesList.length > 0) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);

      // Mark unread messages sent by others as read
      const currentId = currentUser?.id;
      if (currentId) {
        supabase.from('messages')
          .update({ read_at: new Date().toISOString() })
          .eq('conversation_id', chatId)
          .neq('sender_id', currentId)
          .is('read_at', null)
          .then(() => {});
      }
    };
    loadMessages();
    const channel = supabase.channel(`messages-${chatId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${chatId}` }, loadMessages).subscribe();
    return () => { active = false; supabase.removeChannel(channel); if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current); };
  }, [chatId, currentUser]);

  const handleInputChange = (text) => {
    setInputText(text);
    if (broadcastChannelRef.current && currentUser) {
      broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: currentUser.id },
      });
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !currentUser) return;

    const messageText = inputText.trim();
    setInputText(''); 

    try {
      const { error } = await supabase.from('messages').insert({ conversation_id: chatId, sender_id: currentUser.id, body: messageText, media_type: 'text' });
      if (error) throw error;

    } catch (error) {
      console.error("Erreur lors de l'envoi :", error);
    }
  };

  // Voice note / media helpers
  const startWaveform = () => {
    if (waveformInterval.current) return;
    waveformInterval.current = setInterval(() => {
      setWaveformHeights(Array.from({ length: 6 }, () => Math.floor(Math.random() * 22) + 6));
      setRecordDuration((duration) => duration + 0.12);
    }, 120);
  };

  const stopWaveform = () => {
    if (waveformInterval.current) {
      clearInterval(waveformInterval.current);
      waveformInterval.current = null;
    }
  };

  const startRecording = async () => {
    if (!chatId || !currentUser) return;

    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'L’accès au micro est nécessaire pour enregistrer une note vocale.');
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
      setRecording(recordingInstance);
      setRecordDuration(0);
      startWaveform();
    } catch (error) {
      console.error('Erreur démarrage enregistrement :', error);
      Alert.alert('Enregistrement impossible', 'Impossible de démarrer l’enregistrement audio.');
    }
  };

  const uploadMediaToCloudinary = async (uri, resourceType = 'auto', fileName = 'upload') => {
    return uploadToCloudinary(uri, { resourceType, fileName });
  };

  const stopAudioPlayback = async () => {
    if (!audioSound) return;
    try {
      await audioSound.stopAsync();
      await audioSound.unloadAsync();
    } catch (error) {
      console.warn('Erreur arrêt audio:', error);
    }
    setAudioSound(null);
    setPlayingMessageId(null);
  };

  const toggleAudioPlayback = async (message) => {
    if (playingMessageId === message.id) {
      await stopAudioPlayback();
      return;
    }

    try {
      await stopAudioPlayback();
      const sound = new Audio.Sound();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          stopAudioPlayback();
        }
      });
      await sound.loadAsync({ uri: message.mediaUrl }, { shouldPlay: true });
      setAudioSound(sound);
      setPlayingMessageId(message.id);
    } catch (error) {
      console.error('Erreur lecture audio :', error);
      Alert.alert('Erreur audio', 'Impossible de lire le message audio.');
    }
  };

  const pickVideoAndSend = async () => {
    if (!chatId || !currentUser) return;

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission requise', 'L’accès à la galerie est nécessaire pour envoyer une vidéo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
        quality: 0.7,
      });

      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      if (!asset.uri) return;

      const mediaUrl = await uploadMediaToCloudinary(asset.uri, 'video', `chat_${chatId}_${currentUser.id}_${Date.now()}.mp4`);
      const { error } = await supabase.from('messages').insert({ conversation_id: chatId, sender_id: currentUser.id, media_type: 'video', media_url: mediaUrl, body: 'Vidéo' });
      if (error) throw error;
    } catch (error) {
      console.error('Erreur upload vidéo :', error);
      Alert.alert('Erreur vidéo', 'Impossible de télécharger la vidéo.');
    }
  };

  const stopRecordingAndSend = async () => {
    if (!chatId || !currentUser || !recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      const durationMillis = recording.getDurationMillis();
      setRecording(null);
      stopWaveform();
      setRecordDuration(0);

      if (!uri) {
        throw new Error('Impossible de récupérer le fichier audio.');
      }

      const mediaUrl = await uploadMediaToCloudinary(uri, 'auto');
      const { error } = await supabase.from('messages').insert({ conversation_id: chatId, sender_id: currentUser.id, media_type: 'audio', media_url: mediaUrl, body: 'Note vocale' });
      if (error) throw error;
    } catch (error) {
      console.error('Erreur arrêt enregistrement :', error);
      Alert.alert('Erreur audio', 'Impossible d’envoyer la note vocale.');
      setRecording(null);
    }
  };

  const renderMessageItem = ({ item }) => {
    const isMe = item.senderId === currentUser?.id || item.senderId === currentUser?.uid;
    const mediaType = item.mediaType || 'text';
    const isRead = Boolean(item.readAt);

    return (
      <View style={[styles.messageRow, isMe ? styles.myRow : styles.theirRow]}>
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
          {mediaType === 'audio' ? (
            <TouchableOpacity style={styles.audioBubble} onPress={() => toggleAudioPlayback(item)}>
              <Text style={styles.messageText}>{playingMessageId === item.id ? 'Pause audio' : 'Écouter note vocale'}</Text>
            </TouchableOpacity>
          ) : mediaType === 'video' ? (
            <View style={styles.videoWrapper}>
              <Video
                source={{ uri: item.mediaUrl }}
                style={styles.videoPlayer}
                useNativeControls
                resizeMode="contain"
                shouldPlay={false}
              />
              <Text style={styles.videoLabel}>Vidéo envoyée</Text>
            </View>
          ) : (
            <Text style={styles.messageText}>{item.text || 'Message'}</Text>
          )}

          <View style={[styles.metaRow, isMe ? styles.myMetaRow : styles.theirMetaRow]}>
            <Text style={[styles.timeText, isMe ? styles.myTimeText : styles.theirTimeText]}>
              {formatMessageTime(item.timestamp)}
            </Text>
            {isMe && (
              <Text style={[styles.tickIcon, isRead ? styles.tickRead : styles.tickSent]}>
                {isRead ? '✓✓' : '✓'}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  // LiveKit / Call helpers
  const fetchLiveKitToken = async (roomName, identity) => {
    try {
      const response = await requestLiveKitToken(roomName, identity);
      return response?.token || null;
    } catch (err) {
      console.error('requestLiveKitToken error', err);
      return null;
    }
  };

  const initiateCall = async (mode /* 'audio' | 'video' */) => {
    try {
      const roomName = `chat_${chatId}`;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = await fetchLiveKitToken(roomName, sessionData.session?.user?.id);
      if (!token) {
        Alert.alert('Impossible de démarrer l\'appel', 'Le service d\'appel n\'est pas encore configuré.');
        return;
      }
      navigation.navigate('LiveCallScreen', { room: roomName, conversationId: chatId, mode, token });
    } catch (err) {
      console.error('initiateCall failed', err);
      Alert.alert('Erreur appel', 'Impossible de démarrer l\'appel.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0c" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>◁</Text>
        </TouchableOpacity>
        
        <Image
          source={{ uri: recipientProfile?.avatar_url || 'https://via.placeholder.com/150' }}
          style={styles.headerAvatar}
        />

        <View style={styles.headerInfo}>
          <Text style={styles.recipientName} numberOfLines={1}>
            {recipientProfile?.name || (recipientProfile?.username ? `@${recipientProfile.username}` : `Membre #${recipientId?.substring(0, 5) || 'user'}`)}
          </Text>
          <Text style={[styles.statusText, (isRecipientOnline || isRecipientTyping) && styles.statusOnline]}>
            {isRecipientTyping ? 'En train d’écrire...' : isRecipientOnline ? 'En ligne' : 'Vu récemment'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <GlassIconButton icon="☎" style={styles.callHeaderBtn} onPress={() => initiateCall('audio')} accessibilityLabel="Appel audio" />
          <GlassIconButton icon="▣" style={styles.callHeaderBtn} onPress={() => initiateCall('video')} accessibilityLabel="Appel vidéo" />
        </View>
      </View>

      {loading ? (
        <View style={styles.centerLoading}>
          <SkeletonLoader style={styles.skeletonHeaderSmall} />
          <SkeletonLoader style={styles.skeletonHeaderLarge} />
          <SkeletonLoader style={styles.skeletonHeaderSmall} />
          <SkeletonLoader style={styles.skeletonHeaderLarge} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessageItem}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => messages.length > 0 && flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <View style={styles.inputContainer}>
          <GlassIconButton icon="+" style={styles.attachButton} onPress={pickVideoAndSend} accessibilityLabel="Joindre une vidéo" />

          <TextInput
            style={styles.input}
            placeholder="Message..."
            placeholderTextColor="#8a8a9a"
            value={inputText}
            onChangeText={handleInputChange}
            multiline
          />

          {inputText.trim().length > 0 ? (
            <GlassIconButton icon="➤" style={[styles.actionButton, styles.sendButtonActive]} onPress={handleSendMessage} accessibilityLabel="Envoyer le message" />
          ) : (
            <GlassIconButton
              icon={recording ? '■' : <MicrophoneGlyph color="#ffffff" />}
              style={[styles.actionButton, recording ? styles.recordingButton : null]}
              onPress={async () => {
                if (!recording) await startRecording();
                else await stopRecordingAndSend();
              }}
              accessibilityLabel={recording ? 'Arrêter l’enregistrement' : 'Enregistrer une note vocale'}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0c' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)' },
  backButton: { padding: 6 },
  backIcon: { fontSize: 20, color: '#fff' },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#141418', marginLeft: 8 },
  headerInfo: { flex: 1, marginLeft: 12 },
  recipientName: { color: '#fff', fontWeight: '700', fontSize: 16 },
  statusText: { color: '#8a8a9a', fontSize: 12, fontWeight: '500', marginTop: 1 },
  statusOnline: { color: '#34d399', fontWeight: '600' },
  callHeaderBtn: { padding: 8, marginLeft: 4 },
  callHeaderIcon: { color: '#fff', fontSize: 18 },
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  skeletonHeaderSmall: { width: '50%', height: 18, borderRadius: 10, backgroundColor: '#141418', marginBottom: 12 },
  skeletonHeaderLarge: { width: '90%', height: 100, borderRadius: 18, backgroundColor: '#141418', marginBottom: 16 },
  messagesList: { paddingHorizontal: 16, paddingVertical: 16 },
  messageRow: { flexDirection: 'row', marginBottom: 12, width: '100%' },
  myRow: { justifyContent: 'flex-end' },
  theirRow: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6, borderRadius: 18 },
  myBubble: { backgroundColor: '#a613c4', borderBottomRightRadius: 4 },
  theirBubble: { backgroundColor: '#141418', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)' },
  messageText: { color: '#f0f0f2', fontSize: 15, lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  myMetaRow: { alignSelf: 'flex-end' },
  theirMetaRow: { alignSelf: 'flex-start' },
  timeText: { fontSize: 11, marginRight: 4 },
  myTimeText: { color: 'rgba(255, 255, 255, 0.7)' },
  theirTimeText: { color: '#6a6a7a' },
  tickIcon: { fontSize: 12, fontWeight: 'bold' },
  tickSent: { color: 'rgba(255, 255, 255, 0.6)' },
  tickRead: { color: '#38bdf8' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)', backgroundColor: '#0a0a0c' },
  attachButton: { padding: 8 },
  attachIcon: { fontSize: 24, color: '#8a8a9a' },
  input: { flex: 1, backgroundColor: '#141418', color: '#f0f0f2', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 8, marginHorizontal: 8, maxHeight: 100, fontSize: 15 },
  actionButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#141418', justifyContent: 'center', alignItems: 'center' },
  sendButtonActive: { backgroundColor: '#a613c4' },
  recordingButton: { backgroundColor: '#c4295a' },
  audioBubble: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#1f1f27' },
  videoWrapper: { width: 230, height: 180, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' },
  videoPlayer: { width: '100%', height: '100%' },
  videoLabel: { color: '#fff', marginTop: 8, fontSize: 12, textAlign: 'center' },
  actionButtonIcon: { fontSize: 18, color: '#fff' },
});