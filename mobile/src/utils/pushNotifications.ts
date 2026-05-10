import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { Logger } from './logger';
import { apiClient } from '../services/apiClient';

const TAG = 'PushNotifications';

// Check if we are in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

export async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  if (isExpoGo && Platform.OS === 'android') {
    Logger.warn(TAG, 'Push notifications are not supported in Expo Go on Android SDK 53+.');
    return undefined;
  }

  let token;

  try {
    // Dynamically import to prevent runtime crashes on unsupported environments
    const Notifications = await import('expo-notifications');

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        Logger.warn(TAG, 'Failed to get push token for push notification!');
        return;
      }

      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;
        
      if (!projectId) {
        Logger.warn(TAG, 'Project ID not found in app config. Ensure EAS is configured for production builds.');
      }
      
      const pushTokenObject = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );
      token = pushTokenObject.data;
      Logger.info(TAG, `Expo Push Token generated: ${token}`);
    } else {
      Logger.info(TAG, 'Must use physical device for Push Notifications');
    }
  } catch (e: any) {
    if (e.code === 'E_REGISTRATION_FAILED' && e.message.includes('FirebaseApp is not initialized')) {
      Logger.info(TAG, 'Push notifications skipped: google-services.json not configured for native build yet.');
    } else {
      Logger.error(TAG, `Error getting push token: ${e.message}`, e);
    }
  }

  return token;
}

export async function sendPushTokenToBackend(token: string) {
  try {
    await apiClient.post('/api/users/push-token', { pushToken: token });
    Logger.info(TAG, 'Push token successfully sent to backend');
  } catch (error) {
    Logger.error(TAG, 'Failed to send push token to backend', error);
  }
}
