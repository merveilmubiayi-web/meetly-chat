import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { TrashIcon, SendIcon } from './icons';

export default function VoiceRecorderBar({
  duration = 0,
  onCancel,
  onSend,
}) {
  const [waveBars, setWaveBars] = useState([8, 14, 20, 10, 24, 16, 12, 18, 22, 14, 8, 16, 20, 10]);
  const blinkAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Blinking red dot
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 0.2, duration: 500, useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();

    // Live fluctuating wave bars
    const waveTimer = setInterval(() => {
      setWaveBars((prev) =>
        prev.map(() => Math.floor(Math.random() * 20) + 6)
      );
    }, 110);

    return () => {
      loop.stop();
      clearInterval(waveTimer);
    };
  }, [blinkAnim]);

  const formatSeconds = (sec) => {
    const total = Math.floor(sec);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <View style={styles.container}>
      {/* Cancel / Trash Button */}
      <TouchableOpacity
        style={styles.cancelButton}
        onPress={onCancel}
        activeOpacity={0.7}
        accessibilityLabel="Annuler l’enregistrement"
      >
        <TrashIcon size={20} color="#ff3b30" />
      </TouchableOpacity>

      {/* Recording Indicator & Timer */}
      <View style={styles.recordingInfo}>
        <Animated.View style={[styles.redDot, { opacity: blinkAnim }]} />
        <Text style={styles.timerText}>{formatSeconds(duration)}</Text>
      </View>

      {/* Live Waveform */}
      <View style={styles.waveformContainer}>
        {waveBars.map((height, i) => (
          <View key={i} style={[styles.liveBar, { height }]} />
        ))}
      </View>

      {/* Slide / Cancel text or Send Button */}
      <TouchableOpacity
        style={styles.sendVoiceButton}
        onPress={onSend}
        activeOpacity={0.8}
        accessibilityLabel="Envoyer la note vocale"
      >
        <SendIcon size={18} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#141418',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 6,
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cancelButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  redDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff3b30',
    marginRight: 6,
  },
  timerText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  waveformContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 10,
    height: 28,
  },
  liveBar: {
    width: 2.5,
    borderRadius: 1.5,
    backgroundColor: '#a613c4',
  },
  sendVoiceButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#a613c4',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
});

