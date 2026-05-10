/**
 * Chat utilities for TheHoneyBee Mobile App.
 * Port of web/src/utils/chatUtils.js
 */
import { db } from '../config/firebase';
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
  serverTimestamp, query, orderBy, onSnapshot, where,
  writeBatch, increment, Unsubscribe, deleteField
} from 'firebase/firestore';
import { Logger } from './logger';

const TAG = 'Chat';
const chatCreationLocks = new Set<string>();

/**
 * Create or find an existing private chat document.
 * Mirrors web's createChatDocument logic.
 */
export async function createChatDocument(
  userId1: string,
  userId2: string,
  courseName: string = ''
): Promise<string | null> {
  const resolveUserVariants = async (userId: string): Promise<string[]> => {
    if (!userId) return [];
    const variants = new Set([String(userId)]);
    try {
      const studentDoc = await getDoc(doc(db, 'Students', String(userId)));
      if (studentDoc.exists()) {
        const data = studentDoc.data();
        if (data?.uid) variants.add(data.uid);
      }
    } catch { /* noop */ }
    try {
      const teacherDoc = await getDoc(doc(db, 'Teacher', String(userId)));
      if (teacherDoc.exists()) {
        const data = teacherDoc.data();
        if (data?.uid) variants.add(data.uid);
      }
    } catch { /* noop */ }
    return Array.from(variants);
  };

  const u1Variants = await resolveUserVariants(userId1);
  const u2Variants = await resolveUserVariants(userId2);
  const studentKey = u1Variants[0] || String(userId1);
  const teacherKey = u2Variants[0] || String(userId2);
  const courseKey = String(courseName || '').trim();
  const lockKey = [studentKey, teacherKey, courseKey].sort().join('-');

  if (chatCreationLocks.has(lockKey)) {
    return new Promise(resolve =>
      setTimeout(() => resolve(createChatDocument(userId1, userId2, courseName)), 1000)
    );
  }

  chatCreationLocks.add(lockKey);

  try {
    const q = query(
      collection(db, 'chats'),
      where('studentId', '==', studentKey),
      where('teacherId', '==', teacherKey),
      where('name', '==', courseKey)
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].id;
    }

    const adminId = 'admin';
    const users = Array.from(new Set([studentKey, teacherKey, adminId]));

    const chatData = {
      users,
      studentId: studentKey,
      teacherId: teacherKey,
      lastMessage: '',
      lastMessageTime: serverTimestamp(),
      unreadCount: { [studentKey]: 0, [teacherKey]: 0 },
      createdAt: serverTimestamp(),
      name: courseKey,
      createdBy: adminId,
    };

    const newChatRef = await addDoc(collection(db, 'chats'), chatData);
    Logger.info(TAG, `Created new chat: ${newChatRef.id}`);
    return newChatRef.id;
  } catch (error) {
    Logger.error(TAG, 'Error creating chat document', error);
    return null;
  } finally {
    chatCreationLocks.delete(lockKey);
  }
}

/**
 * Send a message to a chat.
 */
export async function sendMessage(
  chatId: string,
  senderId: string,
  senderName: string,
  senderRole: string,
  text: string
): Promise<void> {
  try {
    const messageData = {
      text,
      senderId,
      senderName,
      senderRole,
      timestamp: serverTimestamp(),
      messageType: 'text',
      readBy: [senderId],
    };

    await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);

    // Update chat document with last message
    await setDoc(doc(db, 'chats', chatId), {
      lastMessage: text,
      lastMessageTime: serverTimestamp(),
    }, { merge: true });

    Logger.debug(TAG, `Message sent to chat ${chatId}`);
  } catch (error) {
    Logger.error(TAG, 'Error sending message', error);
    throw error;
  }
}

/**
 * Send a batch broadcast message.
 */
export async function sendBatchMessage(
  batchId: string,
  senderId: string,
  senderName: string,
  senderRole: string,
  text: string
): Promise<void> {
  try {
    const messageData = {
      text,
      senderId,
      senderName,
      senderRole,
      timestamp: serverTimestamp(),
      messageType: 'text',
      readBy: [senderId],
    };

    await addDoc(collection(db, 'batches', batchId, 'messages'), messageData);
    Logger.debug(TAG, `Batch message sent to ${batchId}`);
  } catch (error) {
    Logger.error(TAG, 'Error sending batch message', error);
    throw error;
  }
}

/**
 * Send a community announcement (admin only).
 */
export async function sendAnnouncement(
  senderId: string,
  senderName: string,
  text: string
): Promise<void> {
  try {
    const messageData = {
      text,
      senderId,
      senderName,
      senderRole: 'admin',
      timestamp: serverTimestamp(),
      readBy: [senderId],
    };

    await addDoc(collection(db, 'communityAnnouncements'), messageData);
    Logger.debug(TAG, 'Announcement sent');
  } catch (error) {
    Logger.error(TAG, 'Error sending announcement', error);
    throw error;
  }
}

// --- Channel-based community announcement helpers ---

type CommunityChannel = 'teachers' | 'activeStudents' | 'allStudents';

const CHANNEL_COLLECTION_MAP: Record<CommunityChannel, string> = {
  teachers: 'communityAnnouncements_teachers',
  activeStudents: 'communityAnnouncements_activeStudents',
  allStudents: 'communityAnnouncements_allStudents',
};

/**
 * Send an announcement to a specific community channel (admin only).
 */
export async function sendChannelAnnouncement(
  channel: CommunityChannel,
  senderId: string,
  senderName: string,
  text: string
): Promise<void> {
  const collectionName = CHANNEL_COLLECTION_MAP[channel];
  if (!collectionName) {
    Logger.error(TAG, `Invalid community channel: ${channel}`);
    throw new Error(`Invalid community channel: ${channel}`);
  }
  try {
    const messageData = {
      text,
      senderId,
      senderName,
      senderRole: 'admin',
      channel,
      timestamp: serverTimestamp(),
      readBy: [senderId],
    };
    await addDoc(collection(db, collectionName), messageData);
    Logger.info(TAG, `Channel announcement sent to ${channel}`);
  } catch (error) {
    Logger.error(TAG, `Error sending channel announcement to ${channel}`, error);
    throw error;
  }
}

/**
 * Subscribe to announcements for a specific community channel.
 */
export function subscribeToChannelAnnouncements(
  channel: CommunityChannel,
  callback: (announcements: any[]) => void
): Unsubscribe {
  const collectionName = CHANNEL_COLLECTION_MAP[channel];
  if (!collectionName) {
    Logger.error(TAG, `Invalid community channel: ${channel}`);
    return () => {};
  }
  const q = query(collection(db, collectionName), orderBy('timestamp', 'asc'));

  return onSnapshot(q, (snapshot) => {
    const announcements = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
      timestamp: docSnap.data().timestamp?.toDate(),
    }));
    callback(announcements);
  }, (error) => {
    Logger.error(TAG, `Error subscribing to channel ${channel}`, error);
  });
}

// --- File message helpers ---

/**
 * Send a file/attachment message to a private chat.
 */
export async function sendFileMessage(
  chatId: string,
  senderId: string,
  senderName: string,
  senderRole: string,
  fileData: { fileId: string; fileName: string; fileUrl: string; mimeType: string; fileSize?: number }
): Promise<void> {
  try {
    const messageData = {
      text: '',
      senderId,
      senderName,
      senderRole,
      timestamp: serverTimestamp(),
      messageType: 'file',
      readBy: [senderId],
      fileId: fileData.fileId,
      fileName: fileData.fileName,
      fileUrl: fileData.fileUrl,
      mimeType: fileData.mimeType,
      fileSize: fileData.fileSize || 0,
    };
    await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);
    await setDoc(doc(db, 'chats', chatId), {
      lastMessage: `📎 ${fileData.fileName}`,
      lastMessageTime: serverTimestamp(),
    }, { merge: true });
    Logger.info(TAG, `File message sent to chat ${chatId}: ${fileData.fileName}`);
  } catch (error) {
    Logger.error(TAG, 'Error sending file message', error);
    throw error;
  }
}

/**
 * Send a file/attachment message to a batch chat.
 */
export async function sendBatchFileMessage(
  batchId: string,
  senderId: string,
  senderName: string,
  senderRole: string,
  fileData: { fileId: string; fileName: string; fileUrl: string; mimeType: string; fileSize?: number }
): Promise<void> {
  try {
    const messageData = {
      text: '',
      senderId,
      senderName,
      senderRole,
      timestamp: serverTimestamp(),
      messageType: 'file',
      readBy: [senderId],
      fileId: fileData.fileId,
      fileName: fileData.fileName,
      fileUrl: fileData.fileUrl,
      mimeType: fileData.mimeType,
      fileSize: fileData.fileSize || 0,
    };
    await addDoc(collection(db, 'batches', batchId, 'messages'), messageData);
    Logger.info(TAG, `File message sent to batch ${batchId}: ${fileData.fileName}`);
  } catch (error) {
    Logger.error(TAG, 'Error sending batch file message', error);
    throw error;
  }
}

/**
 * Subscribe to messages in a private chat.
 * Accepts optional currentUserId to filter out messages deleted for this user.
 */
export function subscribeToMessages(
  chatId: string,
  callback: (messages: any[]) => void,
  currentUserId?: string
): Unsubscribe {
  const messagesRef = collection(db, 'chats', chatId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'asc'));

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs
      .map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        timestamp: docSnap.data().timestamp?.toDate(),
      }))
      .filter((msg: any) => {
        if (msg.isPinned) return false;
        // Filter out messages deleted for this user
        if (currentUserId && Array.isArray(msg.deletedFor) && msg.deletedFor.includes(currentUserId)) {
          return false;
        }
        return true;
      });
    callback(messages);
  }, (error) => {
    Logger.error(TAG, `Error subscribing to messages for chat ${chatId}`, error);
  });
}

/**
 * Subscribe to batch broadcast messages.
 * Accepts optional currentUserId to filter out messages deleted for this user.
 */
export function subscribeToBatchMessages(
  batchId: string,
  callback: (messages: any[]) => void,
  currentUserId?: string
): Unsubscribe {
  const messagesRef = collection(db, 'batches', batchId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'asc'));

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs
      .map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        timestamp: docSnap.data().timestamp?.toDate(),
      }))
      .filter((msg: any) => {
        if (currentUserId && Array.isArray(msg.deletedFor) && msg.deletedFor.includes(currentUserId)) {
          return false;
        }
        return true;
      });
    callback(messages);
  }, (error) => {
    Logger.error(TAG, `Error subscribing to batch messages for ${batchId}`, error);
  });
}

/**
 * Subscribe to community announcements (legacy single collection).
 */
export function subscribeToAnnouncements(
  callback: (announcements: any[]) => void
): Unsubscribe {
  const q = query(collection(db, 'communityAnnouncements'), orderBy('timestamp', 'asc'));

  return onSnapshot(q, (snapshot) => {
    const announcements = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
      timestamp: docSnap.data().timestamp?.toDate(),
    }));
    callback(announcements);
  }, (error) => {
    Logger.error(TAG, 'Error subscribing to announcements', error);
  });
}

/**
 * Get all chats for a user (real-time).
 * Simplified version of the web's getUserChats for mobile.
 */
export function getUserChats(
  userId: string,
  userEmail: string,
  userRole: string,
  callback: (chats: any[]) => void
): Unsubscribe {
  Logger.info(TAG, `Getting chats for ${userId} (role: ${userRole})`);

  const chatsRef = collection(db, 'chats');
  const all = new Map<string, any>();
  const unsubscribers: Unsubscribe[] = [];

  const isAdmin = userRole?.toLowerCase() === 'admin';

  const prepareChat = async (docSnapshot: any) => {
    const chatData = docSnapshot.data();
    const participants = Array.isArray(chatData.users) ? chatData.users : [];
    const otherUserId = participants.find((id: string) => id !== userId && id !== 'admin')
      || participants.find((id: string) => id !== userId);

    let otherUserName = '';
    const courseName = chatData.name || '';

    // Try to resolve the other user's name
    if (otherUserId && otherUserId !== 'admin') {
      try {
        // 1. Try Students by doc ID
        const studentDoc = await getDoc(doc(db, 'Students', otherUserId));
        if (studentDoc.exists()) {
          const data = studentDoc.data();
          otherUserName = data?.name || data?.Name || '';
        }
        // 2. Try Teacher by doc ID
        if (!otherUserName) {
          const teacherDoc = await getDoc(doc(db, 'Teacher', otherUserId));
          if (teacherDoc.exists()) {
            const data = teacherDoc.data();
            otherUserName = data?.name || data?.Name || '';
          }
        }
        // 3. Try query Students by email/Gmail (the otherUserId might be an email)
        if (!otherUserName && otherUserId.includes('@')) {
          const emailQuery = query(
            collection(db, 'Students'),
            where('Gmail', '==', otherUserId.toLowerCase())
          );
          const emailSnap = await getDocs(emailQuery);
          if (!emailSnap.empty) {
            const data = emailSnap.docs[0].data();
            otherUserName = data?.name || data?.Name || '';
          }
        }
        // 4. Try query Students by uid field
        if (!otherUserName) {
          const uidQuery = query(
            collection(db, 'Students'),
            where('uid', '==', otherUserId)
          );
          const uidSnap = await getDocs(uidQuery);
          if (!uidSnap.empty) {
            const data = uidSnap.docs[0].data();
            otherUserName = data?.name || data?.Name || '';
          }
        }
      } catch (e) {
        Logger.warn(TAG, `Could not resolve name for user ${otherUserId}`, e);
      }
    }

    // Always show the resolved name as title; use course name as subtitle
    const displayTitle = otherUserName || courseName || 'Chat';

    return {
      id: docSnapshot.id,
      ...chatData,
      title: displayTitle,
      subtitle: otherUserName && courseName ? courseName : '',
      otherParticipantId: otherUserId,
      lastMessageTime: chatData.lastMessageTime?.toDate?.() || null,
    };
  };

  const emit = () => {
    let items = Array.from(all.values());
    // Hide chats hidden for this user (unless admin)
    if (!isAdmin) {
      items = items.filter(c => {
        const hiddenList = Array.isArray(c.hiddenFor) ? c.hiddenFor : [];
        return !hiddenList.includes(userId);
      });
    }
    // Sort by lastMessageTime descending
    items.sort((a, b) => {
      const aTime = a.lastMessageTime?.getTime?.() || 0;
      const bTime = b.lastMessageTime?.getTime?.() || 0;
      return bTime - aTime;
    });
    callback(items);
  };

  // Primary query: chats where user is a participant
  const primaryQuery = query(chatsRef, where('users', 'array-contains', userId));
  const primaryUnsub = onSnapshot(primaryQuery, async (snapshot) => {
    for (const docSnapshot of snapshot.docs) {
      all.set(docSnapshot.id, await prepareChat(docSnapshot));
    }
    emit();
  });
  unsubscribers.push(primaryUnsub);

  // Admin: subscribe to ALL chats
  if (isAdmin) {
    const adminUnsub = onSnapshot(query(chatsRef), async (snapshot) => {
      for (const docSnapshot of snapshot.docs) {
        all.set(docSnapshot.id, await prepareChat(docSnapshot));
      }
      emit();
    });
    unsubscribers.push(adminUnsub);
  }

  return () => {
    unsubscribers.forEach(unsub => unsub());
  };
}

/**
 * Mark messages as read for a user.
 */
export async function markChatAsRead(chatId: string, userId: string): Promise<void> {
  try {
    const messagesQuery = query(
      collection(db, 'chats', chatId, 'messages'),
      where('senderId', '!=', userId)
    );
    const snapshot = await getDocs(messagesQuery);
    const batch = writeBatch(db);
    let updateCount = 0;

    snapshot.docs.forEach(msgDoc => {
      const data = msgDoc.data();
      const readBy = data.readBy || [];
      if (!readBy.includes(userId)) {
        batch.update(msgDoc.ref, {
          readBy: [...readBy, userId],
        });
        updateCount++;
      }
    });

    if (updateCount > 0) {
      await batch.commit();
      Logger.debug(TAG, `Marked ${updateCount} messages as read in chat ${chatId}`);
    }
  } catch (error) {
    Logger.error(TAG, 'Error marking chat as read', error);
  }
}

/**
 * Subscribe to unread count for a specific chat.
 */
export function subscribeToUnreadCount(
  chatId: string,
  userId: string,
  isPrivateChat: boolean,
  callback: (count: number) => void
): Unsubscribe {
  const collectionPath = isPrivateChat
    ? collection(db, 'chats', chatId, 'messages')
    : collection(db, 'batches', chatId, 'messages');

  const messagesQuery = query(collectionPath, where('senderId', '!=', userId));

  return onSnapshot(messagesQuery, (snapshot) => {
    let unreadCount = 0;
    snapshot.docs.forEach(msgDoc => {
      const data = msgDoc.data();
      const readBy = data.readBy || [];
      if (!readBy.includes(userId)) {
        unreadCount++;
      }
    });
    callback(unreadCount);
  });
}

// =====================================================
// DELETE MESSAGE FUNCTIONS (WhatsApp-style)
// =====================================================

/**
 * Delete a message for the current user only (private chat).
 * Adds the userId to the message's `deletedFor` array.
 */
export async function deleteMessageForMe(
  chatId: string,
  messageId: string,
  userId: string,
  isBatchChat: boolean = false
): Promise<void> {
  try {
    const collectionPath = isBatchChat
      ? `batches/${chatId}/messages`
      : `chats/${chatId}/messages`;
    const msgRef = doc(db, collectionPath, messageId);
    const msgSnap = await getDoc(msgRef);
    if (!msgSnap.exists()) return;

    const data = msgSnap.data();
    const deletedFor = Array.isArray(data.deletedFor) ? data.deletedFor : [];
    if (!deletedFor.includes(userId)) {
      deletedFor.push(userId);
    }
    await updateDoc(msgRef, { deletedFor });
    Logger.info(TAG, `Message ${messageId} deleted for user ${userId}`);
  } catch (error) {
    Logger.error(TAG, 'Error deleting message for me', error);
    throw error;
  }
}

/**
 * Delete a message for everyone (private or batch chat).
 * Replaces text with deleted placeholder, clears file data.
 */
export async function deleteMessageForEveryone(
  chatId: string,
  messageId: string,
  senderId: string,
  isBatchChat: boolean = false
): Promise<void> {
  try {
    const collectionPath = isBatchChat
      ? `batches/${chatId}/messages`
      : `chats/${chatId}/messages`;
    const msgRef = doc(db, collectionPath, messageId);
    const msgSnap = await getDoc(msgRef);
    if (!msgSnap.exists()) return;

    const data = msgSnap.data();
    if (data.senderId !== senderId) {
      throw new Error('You can only delete your own messages for everyone');
    }

    await updateDoc(msgRef, {
      text: '',
      deletedForEveryone: true,
      messageType: 'deleted',
      fileId: '',
      fileName: '',
      fileUrl: '',
      mimeType: '',
      fileSize: 0,
    });
    Logger.info(TAG, `Message ${messageId} deleted for everyone`);
  } catch (error) {
    Logger.error(TAG, 'Error deleting message for everyone', error);
    throw error;
  }
}

// =====================================================
// VOICE MESSAGE FUNCTIONS
// =====================================================

/**
 * Send a voice message to a private chat.
 */
export async function sendVoiceMessage(
  chatId: string,
  senderId: string,
  senderName: string,
  senderRole: string,
  audioData: { fileId: string; fileUrl: string; duration: number; fileName: string }
): Promise<void> {
  try {
    const messageData = {
      text: '',
      senderId,
      senderName,
      senderRole,
      timestamp: serverTimestamp(),
      messageType: 'voice',
      readBy: [senderId],
      fileId: audioData.fileId,
      fileUrl: audioData.fileUrl,
      fileName: audioData.fileName,
      mimeType: 'audio/m4a',
      duration: audioData.duration,
    };
    await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);
    await setDoc(doc(db, 'chats', chatId), {
      lastMessage: '🎤 Voice message',
      lastMessageTime: serverTimestamp(),
    }, { merge: true });
    Logger.info(TAG, `Voice message sent to chat ${chatId}`);
  } catch (error) {
    Logger.error(TAG, 'Error sending voice message', error);
    throw error;
  }
}

/**
 * Send a voice message to a batch chat.
 */
export async function sendBatchVoiceMessage(
  batchId: string,
  senderId: string,
  senderName: string,
  senderRole: string,
  audioData: { fileId: string; fileUrl: string; duration: number; fileName: string }
): Promise<void> {
  try {
    const messageData = {
      text: '',
      senderId,
      senderName,
      senderRole,
      timestamp: serverTimestamp(),
      messageType: 'voice',
      readBy: [senderId],
      fileId: audioData.fileId,
      fileUrl: audioData.fileUrl,
      fileName: audioData.fileName,
      mimeType: 'audio/m4a',
      duration: audioData.duration,
    };
    await addDoc(collection(db, 'batches', batchId, 'messages'), messageData);
    Logger.info(TAG, `Voice message sent to batch ${batchId}`);
  } catch (error) {
    Logger.error(TAG, 'Error sending batch voice message', error);
    throw error;
  }
}

// =====================================================
// IMAGE MESSAGE FUNCTIONS
// =====================================================

/**
 * Send an image message to a private chat (from camera or gallery).
 */
export async function sendImageMessage(
  chatId: string,
  senderId: string,
  senderName: string,
  senderRole: string,
  imageData: { fileId: string; fileName: string; fileUrl: string; mimeType: string; fileSize?: number; caption?: string }
): Promise<void> {
  try {
    const messageData = {
      text: imageData.caption || '',
      senderId,
      senderName,
      senderRole,
      timestamp: serverTimestamp(),
      messageType: 'file',
      readBy: [senderId],
      fileId: imageData.fileId,
      fileName: imageData.fileName,
      fileUrl: imageData.fileUrl,
      mimeType: imageData.mimeType,
      fileSize: imageData.fileSize || 0,
    };
    await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);
    await setDoc(doc(db, 'chats', chatId), {
      lastMessage: '📷 Photo',
      lastMessageTime: serverTimestamp(),
    }, { merge: true });
    Logger.info(TAG, `Image message sent to chat ${chatId}`);
  } catch (error) {
    Logger.error(TAG, 'Error sending image message', error);
    throw error;
  }
}

/**
 * Send an image message to a batch chat.
 */
export async function sendBatchImageMessage(
  batchId: string,
  senderId: string,
  senderName: string,
  senderRole: string,
  imageData: { fileId: string; fileName: string; fileUrl: string; mimeType: string; fileSize?: number; caption?: string }
): Promise<void> {
  try {
    const messageData = {
      text: imageData.caption || '',
      senderId,
      senderName,
      senderRole,
      timestamp: serverTimestamp(),
      messageType: 'file',
      readBy: [senderId],
      fileId: imageData.fileId,
      fileName: imageData.fileName,
      fileUrl: imageData.fileUrl,
      mimeType: imageData.mimeType,
      fileSize: imageData.fileSize || 0,
    };
    await addDoc(collection(db, 'batches', batchId, 'messages'), messageData);
    Logger.info(TAG, `Image message sent to batch ${batchId}`);
  } catch (error) {
    Logger.error(TAG, 'Error sending batch image message', error);
    throw error;
  }
}
