import { Platform } from 'react-native';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS, RecordingOptionsPresets } from 'expo-av';

class UniversalAudioRecorder {
  constructor() {
    this.recording = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stream = null;
    this.startTime = 0;
  }

  async start() {
    this.startTime = Date.now();

    // ─── WEB PLATFORM ───
    if (Platform.OS === 'web') {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('L’enregistrement audio n’est pas supporté sur ce navigateur.');
      }
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      const options = MediaRecorder.isTypeSupported('audio/webm')
        ? { mimeType: 'audio/webm' }
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? { mimeType: 'audio/mp4' }
        : {};

      this.mediaRecorder = new MediaRecorder(this.stream, options);
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      this.mediaRecorder.start(100);
      return true;
    }

    // ─── NATIVE PLATFORM (iOS / Android) ───
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('L’accès au microphone est requis.');
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
    this.recording = recordingInstance;
    return true;
  }

  async stop() {
    const duration = Math.max(1, (Date.now() - this.startTime) / 1000);

    // ─── WEB PLATFORM ───
    if (Platform.OS === 'web') {
      if (!this.mediaRecorder) return { uri: null, duration: 0 };

      return new Promise((resolve) => {
        this.mediaRecorder.onstop = () => {
          const mimeType = this.mediaRecorder.mimeType || 'audio/webm';
          const blob = new Blob(this.audioChunks, { type: mimeType });
          const uri = URL.createObjectURL(blob);
          if (this.stream) {
            this.stream.getTracks().forEach((track) => track.stop());
            this.stream = null;
          }
          this.mediaRecorder = null;
          this.audioChunks = [];
          resolve({ uri, duration });
        };
        this.mediaRecorder.stop();
      });
    }

    // ─── NATIVE PLATFORM (iOS / Android) ───
    if (!this.recording) return { uri: null, duration: 0 };
    await this.recording.stopAndUnloadAsync();
    const uri = this.recording.getURI();
    this.recording = null;

    // Reset audio mode for playback
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      shouldDuckAndroid: true,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      playsInSilentModeAndroid: true,
    }).catch(() => {});

    return { uri, duration };
  }

  async cancel() {
    if (Platform.OS === 'web') {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        try {
          this.mediaRecorder.stop();
        } catch {}
      }
      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
        this.stream = null;
      }
      this.mediaRecorder = null;
      this.audioChunks = [];
      return;
    }

    if (this.recording) {
      try {
        await this.recording.stopAndUnloadAsync();
      } catch {}
      this.recording = null;
    }
  }
}

export const createAudioRecorder = () => new UniversalAudioRecorder();

