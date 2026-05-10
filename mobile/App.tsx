/**
 * TheHoneyBee Mobile App — Entry Point
 *
 * Wraps the app with AuthProvider, ErrorBoundary, Toast, and StatusBar.
 */
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { Logger } from './src/utils/logger';
import { setupLocalNotifications } from './src/utils/localNotifications';

Logger.info('App', 'TheHoneyBee Mobile App starting...');

// Initialize local notification channel & permissions
setupLocalNotifications();

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AuthProvider>
          <StatusBar style="auto" />
          <AppNavigator />
          <Toast />
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
