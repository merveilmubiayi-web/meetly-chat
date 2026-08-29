import { Audio } from 'expo-av';
import { Room, RoomEvent } from 'livekit-client';
import { useEffect, useRef, useState } from 'react';
import { Alert, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import GlassIconButton from '../components/GlassIconButton';
import MicrophoneGlyph from '../components/MicrophoneGlyph';
import { livekitConfig } from '../config/livekit';
import { supabase } from '../lib/supabase';

// LiveCallScreen: minimal in-call UI with permission, mute and hangup controls.
// Full LiveKit integration is left as TODO: when you have a backend token and
// the LiveKit client SDK installed, use the `route.params.token` to connect.

export default function LiveCallScreen({ navigation, route }) {
  const roomParam = route?.params?.room || '';
  const conversationId = route?.params?.conversationId || null;
  const mode = route?.params?.mode || 'audio';
  const providedToken = route?.params?.token || null;

  const [roomName] = useState(roomParam || `meetly-${Math.floor(Math.random() * 9000 + 1000)}`);
  const [joined, setJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const roomRef = useRef(null);
  const callSessionIdRef = useRef(null);

  const closeCallSession = async (status = 'ended') => {
    const sessionId = callSessionIdRef.current;
    if (!sessionId) return;
    const { error } = await supabase
      .from('call_sessions')
      .update({ status, ended_at: new Date().toISOString() })
      .eq('id', sessionId);
    if (error) console.warn('Call session close failed:', error.message);
    callSessionIdRef.current = null;
  };

  useEffect(() => {
    return () => {
      // Cleanup: disconnect from LiveKit if connected
      try {
        const r = roomRef.current;
        if (r) {
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
      return false;
    }
  };

  const handleJoin = async () => {
    if (!roomName.trim()) {
      Alert.alert('Nom de salle requis', 'Choisis un nom de salle avant de rejoindre.');
      return;
    }

    const ok = await ensureMicrophone();
    if (!ok) {
      Alert.alert('Permission requise', 'L’accès au micro est nécessaire pour rejoindre l’appel.');
      return;
    }

    setConnecting(true);

    if (!providedToken) {
      setConnecting(false);
      Alert.alert(
        'Appel indisponible',
        'Aucun token LiveKit fourni. Vérifie la configuration de la fonction livekit-token.'
      );
      return;
    }

    // Real join using LiveKit client
    try {
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      await room.prepareConnection(livekitConfig.url, providedToken);
      await room.connect(livekitConfig.url, providedToken, { autoSubscribe: true });
      roomRef.current = room;

      // Publish local audio track by enabling microphone
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
        setIsMuted(false);
      } catch (trackErr) {
        console.warn('enable microphone failed', trackErr);
      }

      room.on(RoomEvent.Disconnected, () => {
        setJoined(false);
        closeCallSession();
      });

      const { data: session } = await supabase.from('call_sessions').insert({
        conversation_id: conversationId,
        room_name: roomName,
        initiated_by: room.localParticipant.identity,
        call_type: mode === 'video' ? 'video' : 'audio',
        status: 'started',
      }).select('id').single();
      callSessionIdRef.current = session?.id || null;
      setJoined(true);
    } catch (err) {
      console.error('LiveKit connect failed', err);
      Alert.alert('Connexion LiveKit échouée', err?.message || String(err));
    } finally {
      setConnecting(false);
    }
  };

  const handleHangup = () => {
    try {
      const r = roomRef.current;
      if (r) {
        r.disconnect().catch(() => {});
        roomRef.current = null;
      }
    } catch (e) {
      console.warn('hangup error', e);
    }
    closeCallSession();
    setJoined(false);
    setIsMuted(false);
    Alert.alert('Appel terminé', 'Vous avez quitté la salle.');
    navigation.goBack();
  };

  const toggleMute = () => {
    // If connected to LiveKit, toggle the microphone via LocalParticipant helper
    try {
      const r = roomRef.current;
      if (r && r.localParticipant && typeof r.localParticipant.setMicrophoneEnabled === 'function') {
        r.localParticipant.setMicrophoneEnabled(!isMuted).catch((e) => console.warn('setMicrophoneEnabled failed', e));
        setIsMuted((v) => !v);
        return;
      }
    } catch (e) {
      console.warn('toggleMute error', e);
    }
    // Fallback local state toggle
    setIsMuted((v) => !v);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0c" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>◁</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Appel — {mode === 'video' ? 'Vidéo' : 'Audio'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.centerCard}>
        <Text style={styles.roomLabel}>Salle</Text>
        <Text style={styles.roomName}>{roomName}</Text>

        {!joined ? (
          <TouchableOpacity style={[styles.button, styles.joinButton]} onPress={handleJoin} disabled={connecting}>
            <Text style={styles.buttonText}>{connecting ? 'Connexion...' : 'Rejoindre l’appel'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.inCallControls}>
            <GlassIconButton
              icon={isMuted ? '×' : <MicrophoneGlyph color="#ffffff" />}
              style={[styles.iconButton, isMuted ? styles.iconButtonMuted : null]}
              onPress={toggleMute}
              accessibilityLabel={isMuted ? 'Réactiver le microphone' : 'Couper le microphone'}
            />

            <GlassIconButton
              icon="☎"
              style={[styles.iconButton, styles.hangupButton]}
              onPress={handleHangup}
              accessibilityLabel="Raccrocher"
            />
          </View>
        )}

        <Text style={styles.hint}>{providedToken ? 'Connexion LiveKit sécurisée.' : 'Token LiveKit manquant.'}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0c' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  backIcon: { color: '#fff', fontSize: 20 },
  headerTitle: { color: '#fff', fontWeight: '700', fontSize: 16 },
  centerCard: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  roomLabel: { color: '#8a8a9a', marginBottom: 8 },
  roomName: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 18 },
  button: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  joinButton: { backgroundColor: '#a613c4' },
  buttonText: { color: '#fff', fontWeight: '700' },
  inCallControls: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  iconButton: { marginHorizontal: 12, width: 72, height: 72, borderRadius: 36, backgroundColor: '#141418', justifyContent: 'center', alignItems: 'center' },
  iconButtonMuted: { backgroundColor: '#333' },
  hangupButton: { backgroundColor: '#c4295a' },
  iconText: { fontSize: 28 },
  hint: { color: '#8a8a9a', marginTop: 16, textAlign: 'center' },
});
