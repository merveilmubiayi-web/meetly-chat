import { Audio, InterruptionModeAndroid, InterruptionModeIOS, RecordingOptionsPresets, Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import {
    addDoc,
    collection,
    doc,
    getDoc,
    onSnapshot,
    orderBy,
    query,
    updateDoc
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
    Alert,
    FlatList,
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
import { cloudinaryConfig } from '../config/cloudinary';
import { auth, db } from '../config/firebase';
import { requestLiveKitToken } from '../config/api';

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
  const currentUser = auth.currentUser;
  const flatListRef = useRef();
  const reconnectTimeout = useRef(null);
  const waveformInterval = useRef(null);

  useEffect(() => {
    let unsubscribe = null;

    const setupListener = () => {
      if (!chatId) return;

      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const q = query(messagesRef, orderBy('timestamp', 'asc'));

      unsubscribe = onSnapshot(q, (snapshot) => {
        const messagesList = [];
        snapshot.forEach((doc) => {
          messagesList.push({ id: doc.id, ...doc.data() });
        });
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
      }, (error) => {
        console.error('Erreur flux messages :', error);
        setLoading(false);
        setIsReconnecting(true);
        if (!reconnectTimeout.current) {
          reconnectTimeout.current = setTimeout(() => {
            reconnectTimeout.current = null;
            setupListener();
          }, 5000);
        }
      });
    };

    setupListener();

    return () => {
      if (unsubscribe) unsubscribe();
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    };
  }, [chatId]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !currentUser) return;

    const messageText = inputText.trim();
    setInputText(''); 

    try {
      const messagesRef = collection(db, "chats", chatId, "messages");
      await addDoc(messagesRef, {
        senderId: currentUser.uid,
        text: messageText,
        mediaType: 'text',
        timestamp: new Date()
      });

      const chatDocRef = doc(db, "chats", chatId);
      await updateDoc(chatDocRef, {
        lastMessage: messageText,
        lastMessageSender: currentUser.uid,
        updatedAt: new Date()
      });

      if (recipientId && recipientId !== currentUser.uid) {
        const recipientDoc = await getDoc(doc(db, 'users', recipientId));
        recipientDoc.data();

        await addDoc(collection(db, 'notifications'), {
          recipientId,
          title: 'Nouveau message',
          message: `${currentUser.displayName || 'Quelqu’un'} vous a envoyé un message.`,
          createdAt: new Date()
        });
      }

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
    const { cloudName, uploadPreset } = cloudinaryConfig;
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

    const response = await fetch(uri);
    const fileBlob = await response.blob();
    const formData = new FormData();
    formData.append('file', fileBlob, `${fileName}`);
    formData.append('upload_preset', uploadPreset);

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Cloudinary upload failed: ${errorText}`);
    }

    const uploadResult = await uploadResponse.json();
    return uploadResult.secure_url || uploadResult.url;
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
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 0.7,
      });

      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      if (!asset.uri) return;

      const mediaUrl = await uploadMediaToCloudinary(asset.uri, 'video', `chat_${chatId}_${currentUser.uid}_${Date.now()}.mp4`);
      const messagesRef = collection(db, "chats", chatId, "messages");
      await addDoc(messagesRef, {
        senderId: currentUser.uid,
        mediaType: 'video',
        mediaUrl,
        duration: asset.duration || null,
        timestamp: new Date()
      });

      const chatDocRef = doc(db, "chats", chatId);
      await updateDoc(chatDocRef, {
        lastMessage: 'Vidéo',
        lastMessageSender: currentUser.uid,
        updatedAt: new Date()
      });
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
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      await addDoc(messagesRef, {
        senderId: currentUser.uid,
        mediaType: 'audio',
        mediaUrl,
        duration: durationMillis,
        timestamp: new Date()
      });

      const chatDocRef = doc(db, "chats", chatId);
      await updateDoc(chatDocRef, {
        lastMessage: 'Note vocale',
        lastMessageSender: currentUser.uid,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Erreur arrêt enregistrement :', error);
      Alert.alert('Erreur audio', 'Impossible d’envoyer la note vocale.');
      setRecording(null);
    }
  };

  const renderMessageItem = ({ item }) => {
    const isMe = item.senderId === currentUser?.uid;
    const mediaType = item.mediaType || 'text';

    return (
      <View style={[styles.messageRow, isMe ? styles.myRow : styles.theirRow]}>
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
          {mediaType === 'audio' ? (
            <TouchableOpacity style={styles.audioBubble} onPress={() => toggleAudioPlayback(item)}>
              <Text style={styles.messageText}>{playingMessageId === item.id ? '⏸️ Pause audio' : '🎧 Écouter note vocale'}</Text>
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
      const token = await fetchLiveKitToken(roomName, currentUser?.uid || 'guest');
      if (!token) {
        Alert.alert('Impossible de démarrer l\'appel', 'Le service d\'appel n\'est pas encore configuré.');
        return;
      }
      navigation.navigate('LiveCallScreen', { room: roomName, mode, token });
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
        <View style={styles.headerInfo}>
          <Text style={styles.recipientName}>Membre #{recipientId?.substring(0, 5)}</Text>
          <Text style={styles.statusText}>En ligne</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity style={{ padding: 8 }} onPress={() => initiateCall('audio')}>
            <Text style={{ color: '#fff' }}>📞</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ padding: 8 }} onPress={() => initiateCall('video')}>
            <Text style={{ color: '#fff' }}>📹</Text>
          </TouchableOpacity>
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
          <TouchableOpacity style={styles.attachButton} onPress={pickVideoAndSend}>
            <Text style={styles.attachIcon}>+</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Message..."
            placeholderTextColor="#8a8a9a"
            value={inputText}
            onChangeText={setInputText}
            multiline
          />

          {/* 💡 Changement d'icône dynamique : Avion (✈️) lorsque texte saisi, microphone (🎙️) sinon */}
          {inputText.trim().length > 0 ? (
            <TouchableOpacity style={[styles.actionButton, styles.sendButtonActive]} onPress={handleSendMessage}>
              <Text style={styles.actionButtonIcon}>✈️</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, recording ? styles.recordingButton : null]}
              onPress={async () => {
                if (!recording) await startRecording();
                else await stopRecordingAndSend();
              }}
            >
              <Text style={styles.actionButtonIcon}>{recording ? '⏹️' : '🎙️'}</Text>
            </TouchableOpacity>
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
  headerInfo: { flex: 1, marginLeft: 16 },
  recipientName: { color: '#fff', fontWeight: '700', fontSize: 16 },
  statusText: { color: '#a613c4', fontSize: 11, fontWeight: '600', marginTop: 1 },
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  skeletonHeaderSmall: { width: '50%', height: 18, borderRadius: 10, backgroundColor: '#141418', marginBottom: 12 },
  skeletonHeaderLarge: { width: '90%', height: 100, borderRadius: 18, backgroundColor: '#141418', marginBottom: 16 },
  messagesList: { paddingHorizontal: 16, paddingVertical: 16 },
  messageRow: { flexDirection: 'row', marginBottom: 12, width: '100%' },
  myRow: { justifyContent: 'flex-end' },
  theirRow: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '75%', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  myBubble: { backgroundColor: '#a613c4', borderBottomRightRadius: 4 },
  theirBubble: { backgroundColor: '#141418', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.03)' },
  messageText: { color: '#f0f0f2', fontSize: 15, lineHeight: 20 },
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