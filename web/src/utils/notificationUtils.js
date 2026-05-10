import { db } from '../services/firebase';
import { collection, addDoc, query, where, getDocs, getDoc, updateDoc, doc, serverTimestamp, orderBy, onSnapshot } from 'firebase/firestore';

/**
 * Create a notification for a user
 * @param {string} recipientId - The recipient's user ID (email or uid)
 * @param {string} type - Type of notification (e.g., 'batch_created')
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {Object} batchDetails - Details about the batch
 * @returns {Promise<string>} - The notification document ID
 */
export const createNotification = async (recipientId, type, title, message, batchDetails = {}) => {
  try {
    const notificationData = {
      recipientId,
      type,
      title,
      message,
      batchDetails,
      read: false,
      createdAt: serverTimestamp(),
      readAt: null
    };

    const docRef = await addDoc(collection(db, 'notifications'), notificationData);
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

/**
 * Create batch creation notifications for teacher and students
 * @param {string} teacherId - Teacher's ID
 * @param {Array} studentIds - Array of student IDs
 * @param {Object} batchData - Batch information
 */
export const createBatchNotifications = async (teacherId, studentIds, batchData) => {
  try {
    const notifications = [];

    // Create notification for teacher
    if (teacherId) {
      const teacherNotification = createNotification(
        teacherId,
        'batch_created',
        'New Batch Assignment',
        `You have been assigned as teacher for the batch "${batchData.batchName}".`,
        {
          batchId: batchData.batchId,
          batchName: batchData.batchName,
          courseId: batchData.courseId,
          courseName: batchData.courseName,
          studentCount: studentIds.length
        }
      );
      notifications.push(teacherNotification);
    }

    // Create notifications for students
    if (studentIds && studentIds.length > 0) {
      const studentNotifications = studentIds.map(studentId =>
        createNotification(
          studentId,
          'batch_created',
          'New Batch Assignment',
          `You have been enrolled in the batch "${batchData.batchName}".`,
          {
            batchId: batchData.batchId,
            batchName: batchData.batchName,
            courseId: batchData.courseId,
            courseName: batchData.courseName,
            teacherId: teacherId
          }
        )
      );
      notifications.push(...studentNotifications);
    }

    // Wait for all notifications to be created
    await Promise.all(notifications);
  } catch (error) {
    // Error creating batch notifications
    throw error;
  }
};

/**
 * Create chat creation notifications for teacher and student
 * @param {string} teacherId - Teacher's ID
 * @param {string} studentId - Student's ID
 * @param {Object} chatData - Chat information
 */
export const createChatNotifications = async (teacherId, studentId, chatData) => {
  try {
    const notifications = [];

    // Create notification for teacher
    if (teacherId) {
      const teacherNotification = createNotification(
        teacherId,
        'chat_created',
        'New One-on-One Chat Assignment',
        `You have been assigned to a one-on-one chat for "${chatData.courseName}".`,
        {
          chatId: chatData.chatId,
          courseName: chatData.courseName,
          studentId: studentId,
          sessionLimit: chatData.sessionLimit,
          allowZoomLink: chatData.allowZoomLink
        }
      );
      notifications.push(teacherNotification);
    }

    // Create notification for student
    if (studentId) {
      const studentNotification = createNotification(
        studentId,
        'chat_created',
        'New One-on-One Chat Assignment',
        `You have been assigned to a one-on-one chat for "${chatData.courseName}".`,
        {
          chatId: chatData.chatId,
          courseName: chatData.courseName,
          teacherId: teacherId,
          sessionLimit: chatData.sessionLimit,
          allowZoomLink: chatData.allowZoomLink
        }
      );
      notifications.push(studentNotification);
    }

    // Wait for all notifications to be created
    await Promise.all(notifications);
  } catch (error) {
    // Error creating chat notifications
    throw error;
  }
};

/**
 * Get notifications for a specific user
 * @param {string} userId - User's ID (email or uid)
 * @param {boolean} unreadOnly - Whether to fetch only unread notifications
 * @returns {Promise<Array>} - Array of notifications
 */
export const getUserNotifications = async (userId, unreadOnly = false) => {
  try {
    // Use a simpler query that doesn't require an index
    let q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', userId)
    );

    const querySnapshot = await getDocs(q);

    let notifications = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate()
    }));

    // Filter for unread notifications if requested
    if (unreadOnly) {
      notifications = notifications.filter(n => !n.read);
    }

    // Sort by creation date (newest first)
    notifications.sort((a, b) => {
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return b.createdAt - a.createdAt;
    });

    return notifications;
  } catch (error) {
    // Error fetching user notifications
    return [];
  }
};

/**
 * Mark a notification as read and remove it from the list
 * @param {string} notificationId - Notification document ID
 */
export const markNotificationAsRead = async (notificationId) => {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      read: true,
      readAt: serverTimestamp()
    });
  } catch (error) {
    // Error marking notification as read
    throw error;
  }
};

/**
 * Get unread notification count for a user
 * @param {string} userId - User's ID (email or uid)
 * @returns {Promise<number>} - Count of unread notifications
 */
export const getUnreadNotificationCount = async (userId) => {
  try {
    const unreadNotifications = await getUserNotifications(userId, true);
    return unreadNotifications.length;
  } catch (error) {
    // Error getting unread notification count
    return 0;
  }
};

/**
 * Subscribe to real-time notifications for a user
 * @param {string} userId - User's ID (email or uid)
 * @param {Function} callback - Callback function to handle notifications
 * @returns {Function} - Unsubscribe function
 */
export const subscribeToUserNotifications = (userId, callback) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', userId)
    );

    return onSnapshot(q, (snapshot) => {
      let notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      }));

      // Sort by creation date (newest first)
      notifications.sort((a, b) => {
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return b.createdAt - a.createdAt;
      });

      callback(notifications);
    });
  } catch (error) {
    // Error subscribing to notifications
    return () => {};
  }
};

/**
 * Helper function to resolve user identifier for notifications
 * This function handles the different ways users are identified in the system
 * @param {string} userId - User ID (could be email, uid, or document ID)
 * @param {string} userType - Type of user ('teacher' or 'student')
 * @returns {Promise<string>} - Resolved user identifier for notifications
 */
export const resolveUserIdentifier = async (userId, userType) => {
  try {
    // For notifications, we'll use email as the primary identifier
    // since it's consistent across all user collections

    const collectionName = userType === 'teacher' ? 'Teacher' : 'Students';

    // First try to get user by document ID directly
    try {
      const userDocRef = doc(db, collectionName, userId);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        const email = userData.Gmail || userData.email;
        return email || userId;
      }
    } catch (e) {
      // Continue to next method
    }

    // If userId looks like an email, use it directly
    if (userId.includes('@')) {
      return userId;
    }

    // Try to find user by uid
    const userByUid = await getDocs(query(collection(db, collectionName), where('uid', '==', userId)));
    if (!userByUid.empty) {
      const userData = userByUid.docs[0].data();
      const email = userData.Gmail || userData.email;
      return email || userId;
    }

    // Fallback to original userId
    return userId;
  } catch (error) {
    // Error resolving user identifier
    return userId;
  }
};
