/**
 * Notification utilities for TheHoneyBee Mobile App.
 * Port of web/src/utils/notificationUtils.js
 */
import { db } from '../config/firebase';
import {
  collection, query, where, onSnapshot, updateDoc, doc,
  serverTimestamp, Unsubscribe
} from 'firebase/firestore';
import { Logger } from './logger';

const TAG = 'Notifications';

export interface Notification {
  id: string;
  recipientId: string;
  type: string;
  title: string;
  message: string;
  batchDetails?: any;
  read: boolean;
  createdAt: Date | null;
  readAt: Date | null;
}

/**
 * Subscribe to real-time notifications for a user.
 */
export function subscribeToUserNotifications(
  userId: string,
  callback: (notifications: Notification[]) => void
): Unsubscribe {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', userId)
    );

    return onSnapshot(q, (snapshot) => {
      let notifications: Notification[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any),
        createdAt: doc.data().createdAt?.toDate() || null,
        readAt: doc.data().readAt?.toDate() || null,
      }));

      // Sort newest first
      notifications.sort((a, b) => {
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      callback(notifications);
    }, (error) => {
      Logger.error(TAG, 'Error subscribing to notifications', error);
    });
  } catch (error) {
    Logger.error(TAG, 'Error setting up notification subscription', error);
    return () => {};
  }
}

/**
 * Mark a notification as read.
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      read: true,
      readAt: serverTimestamp(),
    });
    Logger.debug(TAG, `Marked notification ${notificationId} as read`);
  } catch (error) {
    Logger.error(TAG, 'Error marking notification as read', error);
  }
}
