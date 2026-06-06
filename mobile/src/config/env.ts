/**
 * Environment configuration for TheHoneyBee Mobile App.
 *
 * DEV  → local backend via LAN IP (auto-detected from Expo dev server)
 * PROD → deployed backend (https://thb-unified.onrender.com)
 *
 * Toggle by __DEV__ (auto-set by React Native / Expo):
 *   - `npx expo start`          → __DEV__ = true  → dev URLs
 *   - `eas build` / prod bundle → __DEV__ = false → prod URLs
 *
 * Firebase, DB, and all other config stays the same across environments.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const PROD_API_URL = 'https://thb-unified.onrender.com';
const DEV_PORT = '5001';

/**
 * In dev mode, the mobile device can't reach "localhost" on your computer.
 * We extract the LAN IP from Expo's dev server host (e.g. "192.168.1.5:8081")
 * and use it to construct the backend URL.
 */
function getDevApiUrl(): string {
  // Expo Go provides the debugger host as "IP:PORT"
  const debuggerHost =
    Constants.expoGoConfig?.debuggerHost ??
    Constants.manifest2?.extra?.expoGo?.debuggerHost ??
    (Constants as any).manifest?.debuggerHost;

  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0]; // strip Expo's port
    return `http://${ip}:${DEV_PORT}`;
  }

  // Fallback for Physical Devices & Android Emulator (using actual LAN IP)
  // This ensures that physical devices on the same WiFi can reach the laptop
  return `http://10.133.2.126:${DEV_PORT}`;
}

export const ENV = {
  // Firebase — same for dev & prod
  FIREBASE_API_KEY: 'AIzaSyAkouMyzI1hDFodNH039lIrkWe_xorh9x8',
  FIREBASE_APP_ID: '1:509238464463:web:155787ecf2b5b2f2fdccba',
  FIREBASE_AUTH_DOMAIN: 'chatapp-629ad.firebaseapp.com',
  FIREBASE_MEASUREMENT_ID: 'G-4NMM1R8WW3',
  FIREBASE_MESSAGING_SENDER_ID: '509238464463',
  FIREBASE_PROJECT_ID: 'chatapp-629ad',
  FIREBASE_STORAGE_BUCKET: 'chatapp-629ad.firebasestorage.app',

  // Server route — forced to Render for mobile development
  API_URL: PROD_API_URL,

  CLIENT_URL: __DEV__
    ? 'http://localhost:3000'
    : 'https://thehoneybeelearning.in',

  // Convenience flags
  IS_DEV: __DEV__,
} as const;
