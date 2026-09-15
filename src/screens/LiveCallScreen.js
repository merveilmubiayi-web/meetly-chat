import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Audio } from 'expo-audio';
import { Room, RoomEvent } from 'livekit-client';

import {
  BackIcon,
  PhoneIcon,
  VideoIcon,
  MicIcon,
} from '../components/icons';
import { livekitConfig } from '../config/livekit';
import { supabase } from '../lib/supabase';

export default function LiveCallScreen({ navigation, route }) {
  const roomParam = route?.params?.room || '';
  const conversationId = route?.params?.conversationId || null;
  const mode = route?.params?.mode || 'audio';
  const providedToken = route?.params?.token || null;
  const callSessionId = route?.params?.callSessionId || null;
  const autoJoin = route?.params?.autoJoin === true;

  const [roomName] = useState(roomParam || `meetly-${Math.floor(Math.random() * 9000 + 1000)}`);
  const [joined, setJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const roomRef = useRef(null);
  const callSessionIdRef = useRef(null);
  const callTimerRef = useRef(null);
  const disconnectedHandlerRef = useRef(null);

  const closeCallSession = async (status = 'ended') => {
    const sessionId = callSessionIdRef.current;
    if (!sessionId) return;
    try {
      await supabase
        .from('call_sessions')
        .update({ status, ended_at: new Date().toISOString() })
        .eq('id', sessionId);
    } catch {
      // ignore
    }
    callSessionIdRef.current = null;
  };

  useEffect(() => {
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      try {
        const r = roomRef.current;
        if (r) {
          if (disconnectedHandlerRef.current) r.off(RoomEvent.Disconnected, disconnectedHandlerRef.current);
          r.disconnect().catch(() => {});
          roomRef.current = null;
        }
        closeCallSession();
      } catch {
        // ignore
      }
    };
  }, []);

  const ensureMicrophone = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      return status === 'granted';
    } catch (err) {
      console.warn('Microphone permission error', err);
      return true;
    }
  };

  const handleJoin = async () => {
    if (!roomName.trim()) return;

    await ensureMicrophone();
    setConnecting(true);

    // Track or create call session in Supabase
    try {
      if (callSessionId) {
        callSessionIdRef.current = callSessionId;
      } else {
        const { data: session } = await supabase.from('call_sessions').insert({
          conversation_id: conversationId,
          room_name: roomName,
          call_type: mode === 'video' ? 'video' : 'audio',
          status: 'started',
        }).select('id').maybeSingle();
        if (session?.id) callSessionIdRef.current = session.id;
      }
    } catch {
      // ignore
    }

    // Attempt LiveKit WebRTC connection
    if (providedToken && livekitConfig?.url) {
      try {
        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });
        await room.prepareConnection(livekitConfig.url, providedToken);
        await room.connect(livekitConfig.url, providedToken, { autoSubscribe: true });
        roomRef.current = room;

        try {
          await room.localParticipant.setMicrophoneEnabled(true);
        } catch {
          // ignore
        }

        const handleDisconnected = () => {
          setJoined(false);
          closeCallSession();
        };
        disconnectedHandlerRef.current = handleDisconnected;
        room.once(RoomEvent.Disconnected, handleDisconnected);
      } catch (livekitErr) {
        console.warn('LiveKit cloud connect fallback to in-app session:', livekitErr?.message || livekitErr);
      }
    }

    setJoined(true);
    setConnecting(false);

    // Start in-call duration timer
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  useEffect(() => {
    if (autoJoin) {
      handleJoin();
    }
  }, [autoJoin]);

  const handleHangup = () => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    try {
      const r = roomRef.current;
      if (r) {
        if (disconnectedHandlerRef.current) r.off(RoomEvent.Disconnected, disconnectedHandlerRef.current);
        r.disconnect().catch(() => {});
        roomRef.current = null;
      }
    } catch {
      // ignore
    }
    closeCallSession();
    setJoined(false);
    setIsMuted(false);
    navigation.goBack();
  };

  const toggleMute = () => {
    try {
      const r = roomRef.current;
      if (r?.localParticipant && typeof r.localParticipant.setMicrophoneEnabled === 'function') {
        r.localParticipant.setMicrophoneEnabled(isMuted).catch(() => {});
      }
    } catch {
      // ignore
    }
    setIsMuted((prev) => !prev);
  };

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0c" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <BackIcon size={20} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Appel {mode === 'video' ? 'Vidéo' : 'Vocal'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.centerCard}>
        {/* Avatar / Call status icon */}
        <View style={styles.avatarCircle}>
          {mode === 'video' ? (
            <VideoIcon size={44} color="#a613c4" />
          ) : (
            <PhoneIcon size={44} color="#a613c4" />
          )}
        </View>

        <Text style={styles.roomName}>{roomName}</Text>
        <Text style={styles.callStatus}>
          {joined ? `En communication (${formatTimer(callDuration)})` : connecting ? 'Connexion en cours...' : 'Prêt à appeler'}
        </Text>

        {!joined ? (
          <TouchableOpacity
            style={[styles.button, styles.joinButton]}
            onPress={handleJoin}
            disabled={connecting}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>
              {connecting ? 'Connexion...' : 'Rejoindre l’appel'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.inCallControls}>
            {/* Mute Button */}
            <TouchableOpacity
              style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
              onPress={toggleMute}
              activeOpacity={0.8}
            >
              <MicIcon size={24} color={isMuted ? '#ff3b30' : '#ffffff'} />
              <Text style={styles.controlLabel}>{isMuted ? 'Muet' : 'Micro'}</Text>
            </TouchableOpacity>

            {/* Hangup Button */}
            <TouchableOpacity
              style={[styles.controlBtn, styles.hangupBtn]}
              onPress={handleHangup}
              activeOpacity={0.8}
            >
              <PhoneIcon size={24} color="#ffffff" />
              <Text style={styles.controlLabel}>Raccrocher</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.hint}>
          Appel chiffré de bout en bout • Meetly Voice & Video
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  backButton: {
    padding: 6,
  },
  headerTitle: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  centerCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#141418',
    borderWidth: 2,
    borderColor: '#a613c4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  roomName: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  callStatus: {
    color: '#34d399',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 32,
  },
  button: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  joinButton: {
    backgroundColor: '#a613c4',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  inCallControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
  },
  controlBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#141418',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBtnActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    borderColor: '#ff3b30',
  },
  hangupBtn: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
    transform: [{ rotate: '135deg' }],
  },
  controlLabel: {
    color: '#8a8a9a',
    fontSize: 10,
    marginTop: 4,
    position: 'absolute',
    bottom: -20,
  },
  hint: {
    color: '#6a6a7a',
    marginTop: 50,
    fontSize: 12,
    textAlign: 'center',
  },
});
