import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Image, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Audio } from 'expo-audio';
import { Room, RoomEvent } from 'livekit-client';
import { BackIcon, PhoneIcon, VideoIcon, MicIcon } from '../components/icons';
import { requestLiveKitToken } from '../config/api';
import { livekitConfig } from '../config/livekit';
import { supabase } from '../lib/supabase';
import { presenceManager } from '../utils/presenceManager';

const CALL_STATUS = { IDLE: 'idle', RINGING: 'ringing', CONNECTING: 'connecting', CONNECTED: 'connected', ENDED: 'ended' };
const formatTimer = (seconds) => `${Math.floor(seconds / 60) < 10 ? '0' : ''}${Math.floor(seconds / 60)}:${seconds % 60 < 10 ? '0' : ''}${seconds % 60}`;

function RingingRing({ size, color, delay = 0 }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;
  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(scale, { toValue: 1.6, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.7, duration: 0, useNativeDriver: true }),
      ]),
    ]));
    animation.start();
    return () => animation.stop();
  }, [delay, opacity, scale]);
  return <Animated.View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: color, transform: [{ scale }], opacity }} />;
}

export default function LiveCallScreen({ navigation, route }) {
  const { room: roomParam = '', conversationId = null, mode = 'audio', token: providedToken = null, callSessionId: initialSessionId = null, autoJoin = false, recipientId = null, recipientName = null, recipientAvatar = null } = route?.params || {};
  const [roomName] = useState(roomParam || `meetly-${Math.floor(Math.random() * 9000 + 1000)}`);
  const [joined, setJoined] = useState(false);
  const [callStatus, setCallStatus] = useState(autoJoin ? CALL_STATUS.CONNECTING : CALL_STATUS.RINGING);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(mode === 'video');
  const [connecting, setConnecting] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [recipientOnline, setRecipientOnline] = useState(false);
  const [recipient, setRecipient] = useState({ name: recipientName || 'Correspondant', avatar: recipientAvatar || null });
  const roomRef = useRef(null);
  const callSessionIdRef = useRef(initialSessionId);
  const callTimerRef = useRef(null);
  const disconnectedHandlerRef = useRef(null);

  const updateCallSession = useCallback(async (status, extra = {}) => {
    const sessionId = callSessionIdRef.current;
    if (!sessionId) return;
    try { await supabase.from('call_sessions').update({ status, ...extra }).eq('id', sessionId); } catch { /* ignore */ }
  }, []);

  const closeCallSession = useCallback(async (status = 'ended') => {
    const sessionId = callSessionIdRef.current;
    if (!sessionId) return;
    await updateCallSession(status, { ended_at: new Date().toISOString() });
    callSessionIdRef.current = null;
  }, [updateCallSession]);

  useEffect(() => {
    if (!recipientId) return undefined;
    supabase.from('profiles').select('name, avatar_url').eq('id', recipientId).maybeSingle().then(({ data }) => {
      if (data) setRecipient({ name: data.name || 'Correspondant', avatar: data.avatar_url || null });
    }).catch(() => {});
    setRecipientOnline(presenceManager.isOnline(recipientId));
    return presenceManager.subscribe((map) => setRecipientOnline(map.get(recipientId)?.online === true));
  }, [recipientId]);

  const ensureMicrophone = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status === 'granted' && Audio.setAudioModeAsync) await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      return status === 'granted';
    } catch (error) { console.warn('Microphone permission error', error); return true; }
  };

  const handleJoin = useCallback(async () => {
    if (!roomName.trim() || connecting) return;
    setCallStatus(CALL_STATUS.CONNECTING);
    setConnecting(true);
    await ensureMicrophone();
    try {
      if (!callSessionIdRef.current && conversationId) {
        const { data: session } = await supabase.from('call_sessions').insert({ conversation_id: conversationId, room_name: roomName, call_type: mode === 'video' ? 'video' : 'audio', status: 'ringing' }).select('id').maybeSingle();
        if (session?.id) callSessionIdRef.current = session.id;
      }
      const token = providedToken || (await requestLiveKitToken(roomName, `user_${Date.now()}`).then((result) => result?.token).catch(() => null));
      if (!token || !livekitConfig?.url) throw new Error('Connexion LiveKit indisponible');
      const room = new Room({ adaptiveStream: true, dynacast: true });
      await room.prepareConnection(livekitConfig.url, token);
      await room.connect(livekitConfig.url, token, { autoSubscribe: true });
      roomRef.current = room;
      await room.localParticipant.setMicrophoneEnabled(true).catch(() => {});
      if (mode === 'video') await room.localParticipant.setCameraEnabled(isCameraEnabled).catch(() => {});
      const onDisconnected = () => { setJoined(false); setCallStatus(CALL_STATUS.ENDED); closeCallSession(); };
      disconnectedHandlerRef.current = onDisconnected;
      room.once(RoomEvent.Disconnected, onDisconnected);
      setJoined(true);
      setCallStatus(CALL_STATUS.CONNECTED);
      await updateCallSession('connected', { connected_at: new Date().toISOString() });
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      callTimerRef.current = setInterval(() => setCallDuration((value) => value + 1), 1000);
    } catch (error) {
      Alert.alert('Appel indisponible', 'La connexion a echoue. Vous pouvez reessayer.');
      setCallStatus(CALL_STATUS.RINGING);
    } finally { setConnecting(false); }
  }, [closeCallSession, connecting, conversationId, isCameraEnabled, mode, providedToken, roomName, updateCallSession]);

  const handleHangup = useCallback(async (goBack = true) => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    const room = roomRef.current;
    if (room) {
      if (disconnectedHandlerRef.current) room.off(RoomEvent.Disconnected, disconnectedHandlerRef.current);
      room.disconnect().catch(() => {});
      roomRef.current = null;
    }
    await closeCallSession();
    setJoined(false);
    setCallStatus(CALL_STATUS.ENDED);
    setIsMuted(false);
    if (goBack) navigation.goBack();
  }, [closeCallSession, navigation]);

  useEffect(() => {
    if (autoJoin) handleJoin();
    else if (initialSessionId) updateCallSession('ringing');
  }, [autoJoin, handleJoin, initialSessionId, updateCallSession]);

  useEffect(() => {
    const sessionId = callSessionIdRef.current;
    if (!sessionId) return undefined;
    const channel = supabase.channel(`call-session-${sessionId}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'call_sessions', filter: `id=eq.${sessionId}` }, ({ new: nextSession }) => {
      if (nextSession?.status === 'accepted' && callStatus === CALL_STATUS.RINGING) handleJoin();
      if (nextSession?.status === 'rejected' || nextSession?.status === 'ended') handleHangup(false);
    }).subscribe();
    return () => { supabase.removeChannel(channel).catch(() => {}); };
  }, [callStatus, handleHangup, handleJoin]);

  useEffect(() => () => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    if (roomRef.current) roomRef.current.disconnect().catch(() => {});
    closeCallSession();
  }, [closeCallSession]);

  const toggleMute = () => {
    const room = roomRef.current;
    if (room?.localParticipant) room.localParticipant.setMicrophoneEnabled(isMuted).catch(() => {});
    setIsMuted((value) => !value);
  };
  const toggleSpeaker = () => setIsSpeaker((value) => !value);
  const toggleCamera = () => {
    const room = roomRef.current;
    if (room?.localParticipant?.setCameraEnabled) room.localParticipant.setCameraEnabled(!isCameraEnabled).catch(() => {});
    setIsCameraEnabled((value) => !value);
  };
  const isRinging = callStatus === CALL_STATUS.RINGING && !joined;

  const waitingControls = (
    <View style={styles.inCallControls}>
      <TouchableOpacity style={[styles.controlBtn, styles.hangupBtn]} onPress={() => handleHangup()} accessibilityLabel="Raccrocher">
        <PhoneIcon size={24} color="#ffffff" />
        <Text style={styles.controlLabel}>Raccrocher</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.controlBtn, isSpeaker && styles.controlBtnActive]} onPress={toggleSpeaker} accessibilityLabel="Haut-parleur">
        <Text style={styles.speakerIcon}>HP</Text>
        <Text style={styles.controlLabel}>Haut-parleur</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0c" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => handleHangup()} style={styles.backButton}><BackIcon size={20} color="#ffffff" /></TouchableOpacity>
        <Text style={styles.headerTitle}>{mode === 'video' ? 'Appel video' : 'Appel vocal'}</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.centerCard}>
        <View style={styles.avatarWrap}>
          {isRinging && <RingingRing size={132} color="#a613c4" />}
          {recipient.avatar ? <Image source={{ uri: recipient.avatar }} style={styles.avatar} /> : (mode === 'video' ? <VideoIcon size={44} color="#a613c4" /> : <PhoneIcon size={44} color="#a613c4" />)}
        </View>
        <View style={styles.nameRow}><Text style={styles.recipientName}>{recipient.name}</Text><View style={[styles.onlineDot, recipientOnline && styles.onlineDotActive]} /></View>
        <Text style={styles.roomName}>{roomName}</Text>
        <Text style={styles.callStatus}>{joined ? `En communication (${formatTimer(callDuration)})` : isRinging ? (recipientOnline ? 'Ca sonne...' : 'En attente...') : connecting ? 'Connexion en cours...' : 'Pret a appeler'}</Text>
        {!joined ? waitingControls : (
          <View style={styles.inCallControls}>
            <TouchableOpacity style={[styles.controlBtn, isMuted && styles.controlBtnActive]} onPress={toggleMute}><MicIcon size={24} color={isMuted ? '#ff3b30' : '#ffffff'} /><Text style={styles.controlLabel}>{isMuted ? 'Muet' : 'Micro'}</Text></TouchableOpacity>
            {mode === 'video' && <TouchableOpacity style={[styles.controlBtn, !isCameraEnabled && styles.controlBtnActive]} onPress={toggleCamera}><VideoIcon size={24} color={isCameraEnabled ? '#ffffff' : '#ff3b30'} /><Text style={styles.controlLabel}>{isCameraEnabled ? 'Camera' : 'Video off'}</Text></TouchableOpacity>}
            <TouchableOpacity style={[styles.controlBtn, isSpeaker && styles.controlBtnActive]} onPress={toggleSpeaker}><Text style={styles.speakerIcon}>HP</Text><Text style={styles.controlLabel}>Haut-parleur</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.controlBtn, styles.hangupBtn]} onPress={() => handleHangup()}><PhoneIcon size={24} color="#ffffff" /><Text style={styles.controlLabel}>Raccrocher</Text></TouchableOpacity>
          </View>
        )}
        <Text style={styles.hint}>Appel securise - Meetly Voice &amp; Video</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0c' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  backButton: { padding: 6 },
  headerTitle: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
  centerCard: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  avatarWrap: { width: 132, height: 132, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: '#a613c4' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recipientName: { color: '#ffffff', fontSize: 22, fontWeight: '700', marginBottom: 4 },
  onlineDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#555866', marginBottom: 4 },
  onlineDotActive: { backgroundColor: '#34d399' },
  roomName: { color: '#8a8a9a', fontSize: 13, marginBottom: 6 },
  callStatus: { color: '#34d399', fontSize: 14, fontWeight: '600', marginBottom: 32 },
  inCallControls: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  controlBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#141418', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  controlBtnActive: { backgroundColor: 'rgba(255, 59, 48, 0.2)', borderColor: '#ff3b30' },
  hangupBtn: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  speakerIcon: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  controlLabel: { color: '#8a8a9a', fontSize: 10, position: 'absolute', bottom: -20, textAlign: 'center' },
  hint: { color: '#6a6a7a', marginTop: 50, fontSize: 12, textAlign: 'center' },
});
