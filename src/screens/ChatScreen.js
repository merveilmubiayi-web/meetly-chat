import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { Video } from 'expo-av';

import SkeletonLoader from '../components/SkeletonLoader';
import VoiceNotePlayer from '../components/VoiceNotePlayer';
import VoiceRecorderBar from '../components/VoiceRecorderBar';
import {
  BackIcon,
  PhoneIcon,
  VideoIcon,
  SendIcon,
  PaperclipIcon,
  MicIcon,
  CheckIcon,
  DoubleCheckIcon,
  ClockIcon,
  AlertCircleIcon,
  CameraIcon,
  DocumentIcon,
  PollIcon,
  LocationIcon,
  ZapIcon,
  CloseIcon,
} from '../components/icons';
import { requestLiveKitToken } from '../config/api';
import { getAvatarUri } from '../constants/assets';
import { supabase } from '../lib/supabase';
import { createAudioRecorder } from '../utils/audioRecorder';
import { uploadToCloudinary } from '../utils/cloudinaryUpload';

const formatMessageTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatMessageDateSeparator = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  if (isToday) return 'Aujourd’hui';
  if (isYesterday) return 'Hier';
  return d.toLocaleDateString([], { day: 'numeric', month: 'long', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
};

const QUICK_REPLIES = [
  'Je suis en route ! 🚗',
  'D’accord, parfait ! 👍',
  'Rappelle-moi plus tard 📞',
  'Merci beaucoup 🙏',
  'À tout à l’heure ! 👋',
  'Je suis occupé pour le moment ⏳',
];

export default function ChatScreen({ navigation, route }) {
  const { chatId, recipientId } = route.params || {};

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [recordDuration, setRecordDuration] = useState(0);
  const [isRecordingActive, setIsRecordingActive] = useState(false);
  const [currentPlayingId, setCurrentPlayingId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [recipientProfile, setRecipientProfile] = useState(null);
  const [isRecipientTyping, setIsRecipientTyping] = useState(false);
  const [isRecipientOnline, setIsRecipientOnline] = useState(false);
  const [attachModalVisible, setAttachModalVisible] = useState(false);
  const [quickRepliesVisible, setQuickRepliesVisible] = useState(false);
  const [pollModalVisible, setPollModalVisible] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [selectedMessageAction, setSelectedMessageAction] = useState(null);

  const flatListRef = useRef();
  const audioRecorderRef = useRef(null);
  const recordTimerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const broadcastChannelRef = useRef(null);

  // 1. Charger utilisateur
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user || null));
  }, []);

  // 2. Profil destinataire
  useEffect(() => {
    if (!recipientId) return;
    let active = true;
    supabase
      .from('profiles')
      .select('*')
      .eq('id', recipientId)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data) setRecipientProfile(data);
      });
    return () => {
      active = false;
    };
  }, [recipientId]);

  // 3. Realtime presence & typing
  useEffect(() => {
    if (!chatId || !currentUser) return;
    const channel = supabase
      .channel(`chat-events-${chatId}`)
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

  // 4. Détection des appels entrants
  useEffect(() => {
    if (!chatId || !currentUser) return;

    const handleIncomingCall = async (payload) => {
      const call = payload?.new;
      if (!call || call.initiated_by === currentUser.id || call.status !== 'started') return;

      Alert.alert(
        'Appel entrant',
        `${recipientProfile?.name || 'Votre contact'} vous appelle (${call.call_type === 'video' ? 'Vidéo' : 'Audio'}).`,
        [
          {
            text: 'Refuser',
            style: 'cancel',
            onPress: async () => {
              await supabase
                .from('call_sessions')
                .update({ status: 'rejected', ended_at: new Date().toISOString() })
                .eq('id', call.id);
            },
          },
          {
            text: 'Répondre',
            onPress: async () => {
              try {
                const tokenResp = await requestLiveKitToken(call.room_name, currentUser.id);
                navigation.navigate('LiveCallScreen', {
                  room: call.room_name,
                  conversationId: chatId,
                  mode: call.call_type,
                  token: tokenResp?.token,
                  callSessionId: call.id,
                  autoJoin: true,
                });
              } catch (error) {
                Alert.alert('Appel indisponible', error.message || 'Impossible de rejoindre cet appel.');
              }
            },
          },
        ]
      );
    };

    const channel = supabase
      .channel(`call-sessions-${chatId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'call_sessions', filter: `conversation_id=eq.${chatId}` },
        handleIncomingCall
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [chatId, currentUser, navigation, recipientProfile]);

  // 5. Charger messages & écouter modifications avec Optimistic UI
  useEffect(() => {
    if (!chatId) return undefined;
    let active = true;

    const loadMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', chatId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) {
        console.error('Erreur flux messages :', error);
        setLoading(false);
        return;
      }
      if (!active) return;

      const serverMessages = (data || []).map((msg) => ({
        id: msg.id,
        senderId: msg.sender_id,
        mediaType: msg.media_type || 'text',
        mediaUrl: msg.media_url,
        timestamp: msg.created_at,
        text: msg.body,
        readAt: msg.read_at,
        status: msg.read_at ? 'read' : 'sent',
        pollData: msg.media_type === 'poll' && msg.body?.startsWith('{') ? JSON.parse(msg.body) : null,
      }));

      setMessages((prev) => {
        const pendingLocals = prev.filter((m) => m.status === 'sending' || m.status === 'failed');
        const serverIds = new Set(serverMessages.map((m) => m.id));
        const filteredLocals = pendingLocals.filter((m) => !serverIds.has(m.id));
        return [...serverMessages, ...filteredLocals];
      });

      setLoading(false);

      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);

      const currentId = currentUser?.id;
      if (currentId) {
        supabase
          .from('messages')
          .update({ read_at: new Date().toISOString() })
          .eq('conversation_id', chatId)
          .neq('sender_id', currentId)
          .is('read_at', null)
          .then(() => {});
      }
    };

    loadMessages();

    const channel = supabase
      .channel(`messages-${chatId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${chatId}` },
        loadMessages
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [chatId, currentUser]);

  // 6. Nettoyage enregistrement au démontage
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (audioRecorderRef.current) {
        audioRecorderRef.current.cancel().catch(() => {});
      }
    };
  }, []);

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

  // ─── 🚀 ENVOI OPTIMISTE GÉNÉRIQUE ───
  const sendOptimisticPayload = async ({ text, mediaType = 'text', mediaUrl = null, pollData = null }) => {
    if (!currentUser || !chatId) return;

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const optimisticMessage = {
      id: tempId,
      senderId: currentUser.id,
      mediaType,
      mediaUrl,
      timestamp: nowIso,
      text,
      pollData,
      readAt: null,
      status: 'sending',
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: chatId,
          sender_id: currentUser.id,
          body: pollData ? JSON.stringify(pollData) : text,
          media_type: mediaType,
          media_url: mediaUrl,
        })
        .select()
        .single();

      if (error) throw error;

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId
            ? { ...msg, id: data.id, timestamp: data.created_at, status: 'sent' }
            : msg
        )
      );
    } catch (error) {
      console.error('Erreur envoi message :', error);
      setMessages((prev) =>
        prev.map((msg) => (msg.id === tempId ? { ...msg, status: 'failed' } : msg))
      );
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText('');
    await sendOptimisticPayload({ text, mediaType: 'text' });
  };

  const handleRetryMessage = async (failedMsg) => {
    if (!failedMsg || !currentUser || !chatId) return;

    setMessages((prev) =>
      prev.map((m) => (m.id === failedMsg.id ? { ...m, status: 'sending' } : m))
    );

    try {
      let mediaUrl = failedMsg.mediaUrl;
      if (failedMsg.mediaUrl && (failedMsg.mediaUrl.startsWith('file://') || failedMsg.mediaUrl.startsWith('blob:'))) {
        mediaUrl = await uploadToCloudinary(failedMsg.mediaUrl, {
          resourceType: failedMsg.mediaType === 'audio' ? 'audio' : failedMsg.mediaType === 'video' ? 'video' : 'image',
          fileName: `retry_${Date.now()}`,
        });
      }

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: chatId,
          sender_id: currentUser.id,
          body: failedMsg.text,
          media_type: failedMsg.mediaType,
          media_url: mediaUrl,
        })
        .select()
        .single();

      if (error) throw error;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === failedMsg.id
            ? { ...m, id: data.id, mediaUrl: data.media_url, timestamp: data.created_at, status: 'sent' }
            : m
        )
      );
    } catch (err) {
      console.error('Retry failed:', err);
      setMessages((prev) =>
        prev.map((m) => (m.id === failedMsg.id ? { ...m, status: 'failed' } : m))
      );
    }
  };

  // ─── 🎙️ ENREGISTREMENT AUDIO (CROSS-PLATFORM) ───
  const startRecording = async () => {
    if (!chatId || !currentUser) return;

    try {
      const recorder = createAudioRecorder();
      audioRecorderRef.current = recorder;
      await recorder.start();

      setRecordDuration(0);
      setIsRecordingActive(true);

      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      recordTimerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Démarrage audio échoué :', error);
      Alert.alert('Microphone', error.message || 'Impossible d’accéder au microphone.');
    }
  };

  const cancelRecording = async () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setIsRecordingActive(false);
    setRecordDuration(0);
    if (audioRecorderRef.current) {
      await audioRecorderRef.current.cancel().catch(() => {});
      audioRecorderRef.current = null;
    }
  };

  const stopAndSendRecording = async () => {
    if (!audioRecorderRef.current) return;
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setIsRecordingActive(false);

    try {
      const { uri, duration } = await audioRecorderRef.current.stop();
      audioRecorderRef.current = null;

      if (!uri || duration < 0.8) {
        return;
      }

      const tempId = `temp_voice_${Date.now()}`;
      const nowIso = new Date().toISOString();

      const optimisticVoice = {
        id: tempId,
        senderId: currentUser.id,
        mediaType: 'audio',
        mediaUrl: uri,
        timestamp: nowIso,
        text: 'Note vocale',
        readAt: null,
        status: 'sending',
      };

      setMessages((prev) => [...prev, optimisticVoice]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

      const mediaUrl = await uploadToCloudinary(uri, {
        resourceType: 'audio',
        fileName: `voice_${chatId}_${Date.now()}.m4a`,
      });

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: chatId,
          sender_id: currentUser.id,
          body: 'Note vocale',
          media_type: 'audio',
          media_url: mediaUrl,
        })
        .select()
        .single();

      if (error) throw error;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, id: data.id, mediaUrl: data.media_url, status: 'sent' } : m
        )
      );
    } catch (error) {
      console.error('Erreur envoi note vocale :', error);
      setMessages((prev) =>
        prev.map((m) =>
          m.id.startsWith('temp_voice_') ? { ...m, status: 'failed' } : m
        )
      );
    }
  };

  // ─── 📎 GESTION DES PIÈCES JOINTES ENRICHIES ───
  const handlePickMedia = async (type = 'gallery') => {
    setAttachModalVisible(false);
    if (!chatId || !currentUser) return;

    try {
      let result;
      if (type === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission requise', 'L’accès à la caméra est nécessaire.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images', 'videos'],
          allowsEditing: false,
          quality: 0.8,
        });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission requise', 'L’accès à la galerie est nécessaire.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images', 'videos'],
          allowsEditing: false,
          quality: 0.8,
        });
      }

      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      if (!asset.uri) return;

      const isVideo = asset.type === 'video' || asset.uri.endsWith('.mp4') || asset.uri.endsWith('.mov');
      const tempId = `temp_media_${Date.now()}`;
      const nowIso = new Date().toISOString();

      const optimisticMedia = {
        id: tempId,
        senderId: currentUser.id,
        mediaType: isVideo ? 'video' : 'image',
        mediaUrl: asset.uri,
        timestamp: nowIso,
        text: isVideo ? 'Vidéo' : 'Photo',
        readAt: null,
        status: 'sending',
      };

      setMessages((prev) => [...prev, optimisticMedia]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

      const uploadedUrl = await uploadToCloudinary(asset.uri, {
        resourceType: isVideo ? 'video' : 'image',
        fileName: `chat_media_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
      });

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: chatId,
          sender_id: currentUser.id,
          body: isVideo ? 'Vidéo' : 'Photo',
          media_type: isVideo ? 'video' : 'image',
          media_url: uploadedUrl,
        })
        .select()
        .single();

      if (error) throw error;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, id: data.id, mediaUrl: data.media_url, status: 'sent' } : m
        )
      );
    } catch (err) {
      console.error('Erreur média :', err);
      setMessages((prev) =>
        prev.map((m) => (m.id.startsWith('temp_media_') ? { ...m, status: 'failed' } : m))
      );
    }
  };

  // 📄 Partage de document
  const handlePickDocument = async () => {
    setAttachModalVisible(false);
    // Simuler/envoyer un document sélectionné
    await sendOptimisticPayload({
      text: '📄 Document_Meetly.pdf (1.2 MB)',
      mediaType: 'document',
      mediaUrl: 'https://meetly.app/docs/sample.pdf',
    });
  };

  // 📍 Partage de localisation GPS
  const handleShareLocation = async () => {
    setAttachModalVisible(false);
    await sendOptimisticPayload({
      text: '📍 Position actuelle partagée\nhttps://maps.google.com/?q=-4.4419,15.2663',
      mediaType: 'location',
      mediaUrl: 'https://maps.google.com/?q=-4.4419,15.2663',
    });
  };

  // ⚡ Envoi de réponse rapide
  const handleSendQuickReply = async (replyText) => {
    setQuickRepliesVisible(false);
    await sendOptimisticPayload({ text: replyText, mediaType: 'text' });
  };

  // 📊 Création de sondage
  const handleCreatePoll = async () => {
    if (!pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2) {
      Alert.alert('Sondage incomplet', 'Renseigne une question et au moins 2 options.');
      return;
    }
    const cleanOptions = pollOptions.filter((o) => o.trim()).map((text, index) => ({
      id: `opt_${index}`,
      text: text.trim(),
      votes: [],
    }));

    const pollData = {
      question: pollQuestion.trim(),
      options: cleanOptions,
      creatorId: currentUser?.id,
    };

    setPollModalVisible(false);
    setPollQuestion('');
    setPollOptions(['', '']);

    await sendOptimisticPayload({
      text: `📊 Sondage : ${pollQuestion.trim()}`,
      mediaType: 'poll',
      pollData,
    });
  };

  const handleVotePoll = async (messageItem, optionId) => {
    if (!currentUser || !messageItem.pollData) return;
    const currentPoll = messageItem.pollData;
    const userId = currentUser.id;

    const updatedOptions = currentPoll.options.map((opt) => {
      const alreadyVoted = opt.votes.includes(userId);
      if (opt.id === optionId) {
        return {
          ...opt,
          votes: alreadyVoted ? opt.votes.filter((id) => id !== userId) : [...opt.votes, userId],
        };
      }
      return {
        ...opt,
        votes: opt.votes.filter((id) => id !== userId),
      };
    });

    const updatedPoll = { ...currentPoll, options: updatedOptions };

    setMessages((prev) =>
      prev.map((m) => (m.id === messageItem.id ? { ...m, pollData: updatedPoll } : m))
    );

    await supabase
      .from('messages')
      .update({ body: JSON.stringify(updatedPoll) })
      .eq('id', messageItem.id);
  };

  // ─── 📞 APPELS LIVEKIT FLUIDES ET RÉSISTANTS ───
  const initiateCall = async (mode /* 'audio' | 'video' */) => {
    try {
      if (!chatId || !currentUser?.id) {
        Alert.alert('Appel indisponible', 'La conversation n’est pas prête.');
        return;
      }

      const roomName = `meetly_chat_${chatId}`;
      const tokenResult = await requestLiveKitToken(roomName, currentUser.id);

      const { data: callSession } = await supabase
        .from('call_sessions')
        .insert({
          conversation_id: chatId,
          room_name: roomName,
          initiated_by: currentUser.id,
          call_type: mode,
          status: 'started',
        })
        .select('id')
        .maybeSingle();

      navigation.navigate('LiveCallScreen', {
        room: roomName,
        conversationId: chatId,
        mode,
        token: tokenResult?.token,
        callSessionId: callSession?.id,
        autoJoin: true,
      });
    } catch (err) {
      console.warn('Fallback call startup:', err);
      navigation.navigate('LiveCallScreen', {
        room: `meetly_chat_${chatId}`,
        conversationId: chatId,
        mode,
        autoJoin: true,
      });
    }
  };

  // ─── RENDU DU STATUT DU MESSAGE ───
  const renderMessageStatus = (item) => {
    if (item.status === 'failed') {
      return (
        <TouchableOpacity
          style={styles.failedStatusBtn}
          onPress={() => handleRetryMessage(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <AlertCircleIcon size={14} color="#ef4444" />
          <Text style={styles.retryText}>Réessayer</Text>
        </TouchableOpacity>
      );
    }

    if (item.status === 'sending') {
      return <ClockIcon size={12} color="rgba(255, 255, 255, 0.6)" style={styles.statusIcon} />;
    }

    if (item.status === 'read' || Boolean(item.readAt)) {
      return <DoubleCheckIcon size={15} color="#38bdf8" style={styles.statusIcon} />;
    }

    return <CheckIcon size={14} color="rgba(255, 255, 255, 0.6)" style={styles.statusIcon} />;
  };

  // ─── RENDU D'UN MESSAGE ───
  const renderMessageItem = ({ item, index }) => {
    const isMe = item.senderId === currentUser?.id;
    const mediaType = item.mediaType || 'text';
    const prevMsg = index > 0 ? messages[index - 1] : null;

    const showDateSeparator =
      !prevMsg ||
      formatMessageDateSeparator(item.timestamp) !== formatMessageDateSeparator(prevMsg.timestamp);

    return (
      <View>
        {showDateSeparator && (
          <View style={styles.dateSeparatorWrapper}>
            <View style={styles.dateSeparatorBadge}>
              <Text style={styles.dateSeparatorText}>
                {formatMessageDateSeparator(item.timestamp)}
              </Text>
            </View>
          </View>
        )}

        <View style={[styles.messageRow, isMe ? styles.myRow : styles.theirRow]}>
          <TouchableOpacity
            activeOpacity={0.9}
            onLongPress={() => setSelectedMessageAction(item)}
            style={[
              styles.bubble,
              isMe ? styles.myBubble : styles.theirBubble,
              item.status === 'failed' && styles.failedBubbleBorder,
            ]}
          >
            {mediaType === 'audio' ? (
              <VoiceNotePlayer
                uri={item.mediaUrl}
                isMe={isMe}
                messageId={item.id}
                currentPlayingId={currentPlayingId}
                onPlayStart={(id) => setCurrentPlayingId(id)}
                onPlayStop={() => setCurrentPlayingId(null)}
              />
            ) : mediaType === 'image' ? (
              <View style={styles.imageWrapper}>
                <Image source={{ uri: item.mediaUrl }} style={styles.imageContent} resizeMode="cover" />
              </View>
            ) : mediaType === 'video' ? (
              <View style={styles.videoWrapper}>
                <Video source={{ uri: item.mediaUrl }} style={styles.videoPlayer} useNativeControls resizeMode="contain" shouldPlay={false} />
              </View>
            ) : mediaType === 'poll' && item.pollData ? (
              <View style={styles.pollContainer}>
                <Text style={styles.pollQuestion}>{item.pollData.question}</Text>
                {item.pollData.options.map((opt) => {
                  const hasVoted = opt.votes?.includes(currentUser?.id);
                  const totalVotes = item.pollData.options.reduce((acc, o) => acc + (o.votes?.length || 0), 0);
                  const percent = totalVotes > 0 ? Math.round(((opt.votes?.length || 0) / totalVotes) * 100) : 0;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.pollOptionBtn, hasVoted && styles.pollOptionBtnActive]}
                      onPress={() => handleVotePoll(item, opt.id)}
                    >
                      <View style={[styles.pollProgressBar, { width: `${percent}%` }]} />
                      <Text style={styles.pollOptionText}>{opt.text}</Text>
                      <Text style={styles.pollOptionCount}>{opt.votes?.length || 0} ({percent}%)</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
                {item.text || ''}
              </Text>
            )}

            <View style={[styles.metaRow, isMe ? styles.myMetaRow : styles.theirMetaRow]}>
              <Text style={[styles.timeText, isMe ? styles.myTimeText : styles.theirTimeText]}>
                {formatMessageTime(item.timestamp)}
              </Text>
              {isMe && renderMessageStatus(item)}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0c" />

      {/* ─── HEADER WHATSAPP / META ─── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <BackIcon size={20} color="#ffffff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerUserPress}
          onPress={() => recipientId && navigation.navigate('ProfileScreen', { userId: recipientId })}
          activeOpacity={0.7}
        >
          <Image
            source={{ uri: getAvatarUri(recipientProfile?.avatar_url, recipientProfile?.name) }}
            style={styles.headerAvatar}
          />

          <View style={styles.headerInfo}>
            <Text style={styles.recipientName} numberOfLines={1}>
              {recipientProfile?.name ||
                (recipientProfile?.username
                  ? `@${recipientProfile.username}`
                  : `Membre #${recipientId?.substring(0, 5) || 'user'}`)}
            </Text>
            <Text
              style={[
                styles.statusText,
                (isRecipientOnline || isRecipientTyping) && styles.statusOnline,
              ]}
              numberOfLines={1}
            >
              {isRecipientTyping
                ? 'En train d’écrire...'
                : isRecipientOnline
                ? 'En ligne'
                : 'Vu récemment'}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.callHeaderBtn}
            onPress={() => initiateCall('audio')}
            accessibilityLabel="Appel vocal"
          >
            <PhoneIcon size={20} color="#ffffff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.callHeaderBtn}
            onPress={() => initiateCall('video')}
            accessibilityLabel="Appel vidéo"
          >
            <VideoIcon size={21} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── LISTE DES MESSAGES ─── */}
      {loading ? (
        <View style={styles.centerLoading}>
          <SkeletonLoader style={styles.skeletonSmall} />
          <SkeletonLoader style={styles.skeletonLarge} />
          <SkeletonLoader style={styles.skeletonSmall} />
          <SkeletonLoader style={styles.skeletonLarge} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessageItem}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() =>
            messages.length > 0 && flatListRef.current?.scrollToEnd({ animated: true })
          }
        />
      )}

      {/* ─── BARRE DE SAISIE WHATSAPP ─── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <View style={styles.inputContainer}>
          {isRecordingActive ? (
            <VoiceRecorderBar
              duration={recordDuration}
              onCancel={cancelRecording}
              onSend={stopAndSendRecording}
            />
          ) : (
            <>
              <TouchableOpacity
                style={styles.attachButton}
                onPress={() => setAttachModalVisible(true)}
                accessibilityLabel="Pièces jointes"
              >
                <PaperclipIcon size={22} color="#8a8a9a" />
              </TouchableOpacity>

              <TextInput
                style={styles.input}
                placeholder="Message..."
                placeholderTextColor="#8a8a9a"
                value={inputText}
                onChangeText={handleInputChange}
                multiline
              />

              {inputText.trim().length > 0 ? (
                <TouchableOpacity
                  style={styles.sendButton}
                  onPress={handleSendMessage}
                  accessibilityLabel="Envoyer"
                  activeOpacity={0.8}
                >
                  <SendIcon size={18} color="#ffffff" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.micButton}
                  onPress={startRecording}
                  accessibilityLabel="Note vocale"
                  activeOpacity={0.8}
                >
                  <MicIcon size={20} color="#ffffff" />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* ─── MENU SÉLECTEUR DE PIÈCES JOINTES ENRICHI ─── */}
      <Modal
        visible={attachModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAttachModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setAttachModalVisible(false)}
        >
          <View style={styles.attachSheet}>
            <View style={styles.attachSheetHandle} />
            <Text style={styles.attachSheetTitle}>Partager</Text>

            <View style={styles.attachGrid}>
              <TouchableOpacity style={styles.gridOption} onPress={() => handlePickMedia('camera')}>
                <View style={[styles.gridIconCircle, { backgroundColor: '#a613c4' }]}>
                  <CameraIcon size={22} color="#ffffff" />
                </View>
                <Text style={styles.gridOptionLabel}>Caméra</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.gridOption} onPress={() => handlePickMedia('gallery')}>
                <View style={[styles.gridIconCircle, { backgroundColor: '#2563eb' }]}>
                  <PaperclipIcon size={22} color="#ffffff" />
                </View>
                <Text style={styles.gridOptionLabel}>Galerie</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.gridOption} onPress={handlePickDocument}>
                <View style={[styles.gridIconCircle, { backgroundColor: '#7c3aed' }]}>
                  <DocumentIcon size={22} color="#ffffff" />
                </View>
                <Text style={styles.gridOptionLabel}>Document</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.gridOption}
                onPress={() => {
                  setAttachModalVisible(false);
                  setQuickRepliesVisible(true);
                }}
              >
                <View style={[styles.gridIconCircle, { backgroundColor: '#f59e0b' }]}>
                  <ZapIcon size={22} color="#ffffff" />
                </View>
                <Text style={styles.gridOptionLabel}>Réponses</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.gridOption}
                onPress={() => {
                  setAttachModalVisible(false);
                  setPollModalVisible(true);
                }}
              >
                <View style={[styles.gridIconCircle, { backgroundColor: '#10b981' }]}>
                  <PollIcon size={22} color="#ffffff" />
                </View>
                <Text style={styles.gridOptionLabel}>Sondage</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.gridOption} onPress={handleShareLocation}>
                <View style={[styles.gridIconCircle, { backgroundColor: '#ef4444' }]}>
                  <LocationIcon size={22} color="#ffffff" />
                </View>
                <Text style={styles.gridOptionLabel}>Position</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.cancelAttachBtn} onPress={() => setAttachModalVisible(false)}>
              <Text style={styles.cancelAttachText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── MODALE RÉPONSES RAPIDES ─── */}
      <Modal visible={quickRepliesVisible} transparent animationType="slide" onRequestClose={() => setQuickRepliesVisible(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setQuickRepliesVisible(false)}>
          <View style={styles.attachSheet}>
            <View style={styles.attachSheetHandle} />
            <Text style={styles.attachSheetTitle}>⚡ Réponses rapides</Text>
            {QUICK_REPLIES.map((reply, idx) => (
              <TouchableOpacity key={idx} style={styles.quickReplyRow} onPress={() => handleSendQuickReply(reply)}>
                <Text style={styles.quickReplyText}>{reply}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancelAttachBtn} onPress={() => setQuickRepliesVisible(false)}>
              <Text style={styles.cancelAttachText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── MODALE CRÉATION DE SONDAGE ─── */}
      <Modal visible={pollModalVisible} transparent animationType="slide" onRequestClose={() => setPollModalVisible(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setPollModalVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.attachSheet}>
            <View style={styles.attachSheetHandle} />
            <Text style={styles.attachSheetTitle}>📊 Créer un sondage</Text>
            <TextInput
              style={styles.pollInput}
              placeholder="Pose une question..."
              placeholderTextColor="#8a8a9a"
              value={pollQuestion}
              onChangeText={setPollQuestion}
            />
            {pollOptions.map((opt, i) => (
              <TextInput
                key={i}
                style={styles.pollInput}
                placeholder={`Option ${i + 1}`}
                placeholderTextColor="#8a8a9a"
                value={opt}
                onChangeText={(text) => {
                  const copy = [...pollOptions];
                  copy[i] = text;
                  setPollOptions(copy);
                }}
              />
            ))}
            {pollOptions.length < 5 && (
              <TouchableOpacity style={styles.addOptionBtn} onPress={() => setPollOptions([...pollOptions, ''])}>
                <Text style={styles.addOptionText}>+ Ajouter une option</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.primaryPollBtn} onPress={handleCreatePoll}>
              <Text style={styles.primaryPollText}>Créer et envoyer</Text>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* ─── MODALE D'ACTIONS SUR UN MESSAGE ─── */}
      <Modal visible={Boolean(selectedMessageAction)} transparent animationType="fade" onRequestClose={() => setSelectedMessageAction(null)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSelectedMessageAction(null)}>
          <View style={styles.actionMenuSheet}>
            <View style={styles.attachSheetHandle} />
            {selectedMessageAction?.status === 'failed' && (
              <TouchableOpacity
                style={styles.messageActionRow}
                onPress={() => {
                  const target = selectedMessageAction;
                  setSelectedMessageAction(null);
                  handleRetryMessage(target);
                }}
              >
                <AlertCircleIcon size={18} color="#ef4444" />
                <Text style={[styles.messageActionText, { color: '#ef4444' }]}>Réessayer l’envoi</Text>
              </TouchableOpacity>
            )}
            {Boolean(selectedMessageAction?.text) && (
              <TouchableOpacity
                style={styles.messageActionRow}
                onPress={async () => {
                  await Clipboard.setStringAsync(selectedMessageAction.text);
                  setSelectedMessageAction(null);
                  Alert.alert('Copié', 'Texte copié dans le presse-papier.');
                }}
              >
                <Text style={styles.messageActionEmoji}>📋</Text>
                <Text style={styles.messageActionText}>Copier le texte</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.messageActionRow}
              onPress={() => {
                setMessages((prev) => prev.filter((m) => m.id !== selectedMessageAction.id));
                setSelectedMessageAction(null);
              }}
            >
              <Text style={styles.messageActionEmoji}>🗑️</Text>
              <Text style={[styles.messageActionText, { color: '#ff3b30' }]}>Supprimer pour moi</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelAttachBtn} onPress={() => setSelectedMessageAction(null)}>
              <Text style={styles.cancelAttachText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0c' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: '#0a0a0c',
  },
  backButton: { padding: 6 },
  headerUserPress: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 4 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#141418' },
  headerInfo: { marginLeft: 10, flex: 1 },
  recipientName: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  statusText: { color: '#8a8a9a', fontSize: 11, fontWeight: '500', marginTop: 1 },
  statusOnline: { color: '#34d399', fontWeight: '600' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  callHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  skeletonSmall: { width: '45%', height: 40, borderRadius: 16, backgroundColor: '#141418', alignSelf: 'flex-start', marginBottom: 12 },
  skeletonLarge: { width: '65%', height: 50, borderRadius: 16, backgroundColor: '#141418', alignSelf: 'flex-end', marginBottom: 12 },
  messagesList: { paddingHorizontal: 12, paddingVertical: 14 },
  dateSeparatorWrapper: { alignItems: 'center', marginVertical: 12 },
  dateSeparatorBadge: { backgroundColor: 'rgba(255, 255, 255, 0.08)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  dateSeparatorText: { color: '#8a8a9a', fontSize: 11, fontWeight: '600' },
  messageRow: { flexDirection: 'row', marginBottom: 8, width: '100%' },
  myRow: { justifyContent: 'flex-end' },
  theirRow: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, borderRadius: 16 },
  myBubble: { backgroundColor: '#a613c4', borderBottomRightRadius: 4 },
  theirBubble: { backgroundColor: '#18181f', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)' },
  failedBubbleBorder: { borderWidth: 1, borderColor: '#ef4444' },
  messageText: { fontSize: 14.5, lineHeight: 20 },
  myMessageText: { color: '#ffffff' },
  theirMessageText: { color: '#f0f0f2' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 3 },
  myMetaRow: { alignSelf: 'flex-end' },
  theirMetaRow: { alignSelf: 'flex-start' },
  timeText: { fontSize: 10, marginRight: 3 },
  myTimeText: { color: 'rgba(255, 255, 255, 0.75)' },
  theirTimeText: { color: '#8a8a9a' },
  statusIcon: { marginLeft: 2 },
  failedStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  retryText: { color: '#ef4444', fontSize: 10, fontWeight: '700', marginLeft: 3 },
  imageWrapper: { width: 220, height: 160, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000', marginBottom: 4 },
  imageContent: { width: '100%', height: '100%' },
  videoWrapper: { width: 220, height: 160, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000', marginBottom: 4 },
  videoPlayer: { width: '100%', height: '100%' },
  pollContainer: { minWidth: 200, paddingVertical: 4 },
  pollQuestion: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 8 },
  pollOptionBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  pollOptionBtnActive: { borderColor: '#34d399', borderWidth: 1 },
  pollProgressBar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(52, 211, 153, 0.25)' },
  pollOptionText: { color: '#fff', fontSize: 13, fontWeight: '600', zIndex: 1 },
  pollOptionCount: { color: 'rgba(255,255,255,0.7)', fontSize: 11, zIndex: 1 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: '#0a0a0c',
  },
  attachButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: '#141418',
    color: '#ffffff',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginHorizontal: 8,
    maxHeight: 110,
    fontSize: 14.5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#a613c4', justifyContent: 'center', alignItems: 'center' },
  micButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#a613c4', justifyContent: 'center', alignItems: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.65)', justifyContent: 'flex-end' },
  attachSheet: {
    backgroundColor: '#141418',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  attachSheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#3a3a48', alignSelf: 'center', marginBottom: 16 },
  attachSheetTitle: { color: '#ffffff', fontSize: 16, fontWeight: '700', marginBottom: 16 },
  attachGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 14 },
  gridOption: { width: '30%', alignItems: 'center', marginBottom: 10 },
  gridIconCircle: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  gridOptionLabel: { color: '#f0f0f2', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  quickReplyRow: { paddingVertical: 12, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  quickReplyText: { color: '#ffffff', fontSize: 14, fontWeight: '500' },
  pollInput: { backgroundColor: '#0a0a0c', color: '#fff', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  addOptionBtn: { paddingVertical: 8, alignItems: 'center', marginBottom: 14 },
  addOptionText: { color: '#a613c4', fontWeight: '700', fontSize: 13 },
  primaryPollBtn: { backgroundColor: '#a613c4', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  primaryPollText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cancelAttachBtn: { marginTop: 14, paddingVertical: 12, alignItems: 'center', backgroundColor: '#20202a', borderRadius: 14 },
  cancelAttachText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  actionMenuSheet: { backgroundColor: '#141418', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  messageActionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderColor: 'rgba(255, 255, 255, 0.04)' },
  messageActionEmoji: { fontSize: 18, marginRight: 12 },
  messageActionText: { color: '#f0f0f2', fontSize: 15, fontWeight: '600' },
});