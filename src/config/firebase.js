import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getAuth, initializeAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDkmwdp23AZ7zo6tVMv9846S9zMbM_vQEE",
  authDomain: "meetly-0.firebaseapp.com",
  databaseURL: "https://meetly-0-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "meetly-0",
  storageBucket: "meetly-0.firebasestorage.app",
  messagingSenderId: "903795394253",
  appId: "1:903795394253:web:715cc3ced718d08a638b84",
  measurementId: "G-EX9LTDZE1E"
};
const app = initializeApp(firebaseConfig);
let analytics = null;
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch (error) {
    console.warn('firebase: analytics is not supported in this environment', error?.message);
  }
}

let auth;
if (Platform.OS !== 'web') {
  try {
    const { getReactNativePersistence } = require('firebase/auth/react-native');
    console.log('firebase: initializing React Native auth with AsyncStorage persistence');
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
    console.log('firebase: initializeAuth succeeded');
  } catch (error) {
    console.warn('firebase: initializeAuth failed, falling back to getAuth', error?.message);
    console.warn(error?.stack);
    auth = getAuth(app);
  }
} else {
  auth = getAuth(app);
}

const firestore = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false,
});

const realtimeDB = getDatabase(app);
const storage = getStorage(app);
const db = getFirestore(app);

export { app, auth, analytics, realtimeDB as database, db, firestore, realtimeDB, storage };

