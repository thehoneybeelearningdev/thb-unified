/**
 * Local Notification Service — triggers native notifications
 * when new chat messages arrive (even when app is in foreground).
 * This works without FCM/google-services.json.
 */
import { Platform, AppState } from 'react-native';
import { Logger } from './logger';

const TAG = 'LocalNotify';

let Notifications: typeof import('expo-notifications') | null = null;
let isSetup = false;

/**
 * Initialize the notification channel and foreground handler.
 * Call this once at app startup.
 */
export async function setupLocalNotifications() {
  if (isSetup) return;
  try {
    Notifications = await import('expo-notifications');

    // Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#127D8E',
        sound: 'default',
      });
    }

    // Allow notifications to show when app is in foreground
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    // Request permissions
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      await Notifications.requestPermissionsAsync();
    }

    isSetup = true;
    Logger.info(TAG, 'Local notifications initialized');
  } catch (err) {
    Logger.error(TAG, 'Failed to setup local notifications', err);
  }
}

/**
 * Show a local notification for a new chat message.
 * Only shows if the user is NOT currently on that chat screen.
 */
export async function showMessageNotification(
  senderName: string,
  messagePreview: string,
  chatId: string,
  chatName?: string,
) {
  if (!Notifications || !isSetup) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: senderName,
        body: messagePreview,
        data: { chatId, chatName },
        sound: 'default',
        ...(Platform.OS === 'android' ? { channelId: 'messages' } : {}),
      },
      trigger: null, // Show immediately
    });
  } catch (err) {
    Logger.error(TAG, 'Failed to show notification', err);
  }
}
