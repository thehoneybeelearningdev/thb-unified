/**
 * Firebase initialization for the mobile app.
 * Uses the Firebase JS SDK (compatible with Expo managed workflow).
 * Mirrors web/src/services/firebase.js
 */
import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, GoogleAuthProvider } from 'firebase/auth';
// @ts-ignore — getReactNativePersistence is available at runtime in the RN bundle
import { getReactNativePersistence } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENV } from './env';

const firebaseConfig = {
  apiKey: ENV.FIREBASE_API_KEY,
  authDomain: ENV.FIREBASE_AUTH_DOMAIN,
  projectId: ENV.FIREBASE_PROJECT_ID,
  storageBucket: ENV.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: ENV.FIREBASE_MESSAGING_SENDER_ID,
  appId: ENV.FIREBASE_APP_ID,
  measurementId: ENV.FIREBASE_MEASUREMENT_ID,
};

// Prevent re-initialization on hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Use AsyncStorage for auth persistence (React Native)
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });


const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true
});

export { app, auth, googleProvider, db };
