import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Audio } from 'expo-audio';
import { PlayIcon, PauseIcon, MicIcon } from './icons';

// Generate consistent fake or metering-based waveform bars for each audio
const generateBars = (seedStr = 'meetly') => {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const count = 28;
  const bars = [];
  for (let i = 0; i < count; i++) {
    const val = Math.abs(Math.sin((hash + i * 7) * 0.45));
    bars.push(Math.max(4, Math.round(val * 24)));
  }
  return bars;
};

const formatAudioTime = (millis) => {
  if (!millis || millis < 0 || isNaN(millis)) return '0:00';
  const totalSeconds = Math.floor(millis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

export default function VoiceNotePlayer({
  uri,
  durationMillis,
  isMe = true,
  messageId,
  currentPlayingId,
  onPlayStart,
  onPlayStop,
}) {
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [duration, setDuration] = useState(durationMillis || 0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [bars] = useState(() => generateBars(uri || messageId || 'voice'));
  const soundRef = useRef(null);

  const isCurrentActive = currentPlayingId === messageId && isPlaying;

  useEffect(() => {
    // When another message starts playing, pause this one
    if (currentPlayingId !== messageId && soundRef.current && isPlaying) {
      soundRef.current.pauseAsync().catch(() => {});
      setIsPlaying(false);
    }
  }, [currentPlayingId, messageId, isPlaying]);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const onPlaybackStatusUpdate = (status) => {
    if (!status.isLoaded) {
      if (status.error) {
        console.warn(`Audio playback error: ${status.error}`);
      }
      return;
    }

    setPositionMillis(status.positionMillis || 0);
    if (status.durationMillis && !duration) {
      setDuration(status.durationMillis);
    }
    setIsPlaying(status.isPlaying);

    if (status.didJustFinish) {
      setIsPlaying(false);
      setPositionMillis(0);
      if (soundRef.current) {
        soundRef.current.setPositionAsync(0).catch(() => {});
      }
      if (onPlayStop) onPlayStop(messageId);
    }
  };

  const togglePlay = async () => {
    if (!uri) return;

    try {
      if (soundRef.current) {
        if (isPlaying) {
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
          if (onPlayStop) onPlayStop(messageId);
        } else {
          if (onPlayStart) onPlayStart(messageId);
          await soundRef.current.playAsync();
          setIsPlaying(true);
        }
        return;
      }

      // Load sound instance
      if (onPlayStart) onPlayStart(messageId);
      const { sound: newSound, status } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, rate: playbackSpeed, shouldCorrectPitch: true },
        onPlaybackStatusUpdate
      );

      soundRef.current = newSound;
      setSound(newSound);
      setIsPlaying(true);
      if (status.durationMillis) {
        setDuration(status.durationMillis);
      }
    } catch (err) {
      console.error('Error playing voice note:', err);
      setIsPlaying(false);
    }
  };

  const toggleSpeed = async () => {
    const nextSpeed = playbackSpeed === 1.0 ? 1.5 : playbackSpeed === 1.5 ? 2.0 : 1.0;
    setPlaybackSpeed(nextSpeed);
    if (soundRef.current) {
      try {
        await soundRef.current.setRateAsync(nextSpeed, true);
      } catch (e) {
        console.warn('Could not set rate', e);
      }
    }
  };

  const handleSeek = async (barIndex) => {
    if (!duration || !soundRef.current) return;
    const seekPosition = (barIndex / bars.length) * duration;
    try {
      await soundRef.current.setPositionAsync(seekPosition);
      setPositionMillis(seekPosition);
    } catch (e) {
      console.warn('Seek error:', e);
    }
  };

  const progress = duration > 0 ? Math.min(1, Math.max(0, positionMillis / duration)) : 0;
  const activeBarCount = Math.floor(progress * bars.length);

  return (
    <View style={styles.container}>
      {/* Play/Pause Button */}
      <TouchableOpacity
        style={[
          styles.playButton,
          isMe ? styles.playButtonMe : styles.playButtonThem,
        ]}
        onPress={togglePlay}
        activeOpacity={0.8}
        accessibilityLabel={isCurrentActive ? 'Mettre en pause' : 'Écouter'}
      >
        {isCurrentActive ? (
          <PauseIcon size={18} color="#ffffff" />
        ) : (
          <PlayIcon size={18} color="#ffffff" />
        )}
      </TouchableOpacity>

      {/* Waveform & Duration */}
      <View style={styles.waveColumn}>
        <View style={styles.waveRow}>
          {bars.map((height, idx) => {
            const isPlayed = idx <= activeBarCount;
            return (
              <TouchableOpacity
                key={idx}
                onPress={() => handleSeek(idx)}
                style={styles.barTouchArea}
                hitSlop={{ top: 8, bottom: 8, left: 1, right: 1 }}
              >
                <View
                  style={[
                    styles.bar,
                    { height },
                    isPlayed
                      ? isMe
                        ? styles.barPlayedMe
                        : styles.barPlayedThem
                      : isMe
                      ? styles.barUnplayedMe
                      : styles.barUnplayedThem,
                  ]}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.footerRow}>
          <Text style={[styles.timeText, isMe ? styles.timeMe : styles.timeThem]}>
            {isPlaying || positionMillis > 0
              ? formatAudioTime(positionMillis)
              : formatAudioTime(duration || durationMillis || 0)}
          </Text>

          {isCurrentActive && (
            <TouchableOpacity onPress={toggleSpeed} style={styles.speedBadge}>
              <Text style={styles.speedText}>{playbackSpeed}x</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Mic icon indicator */}
      <View style={styles.micBadge}>
        <MicIcon size={14} color={isMe ? 'rgba(255,255,255,0.7)' : '#8a8a9a'} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    minWidth: 210,
    maxWidth: 260,
  },
  playButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  playButtonMe: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  playButtonThem: {
    backgroundColor: '#a613c4',
  },
  waveColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 26,
    gap: 2,
  },
  barTouchArea: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bar: {
    width: 2.5,
    borderRadius: 1.5,
  },
  barPlayedMe: {
    backgroundColor: '#ffffff',
  },
  barUnplayedMe: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  barPlayedThem: {
    backgroundColor: '#a613c4',
  },
  barUnplayedThem: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  timeMe: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  timeThem: {
    color: '#8a8a9a',
  },
  speedBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  speedText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  micBadge: {
    marginLeft: 6,
    alignSelf: 'flex-end',
    marginBottom: 6,
  },
});

