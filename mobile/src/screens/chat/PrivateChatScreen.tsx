/**
 * Private Chat Screen — Real-time 1-to-1 messaging with WhatsApp-style features.
 * Voice recording, camera capture, message long-press delete, inline attachments.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import {
  subscribeToMessages, sendMessage, markChatAsRead,
  sendFileMessage, sendVoiceMessage, sendImageMessage,
} from '../../utils/chatUtils';
import { fileService } from '../../services/fileService';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../../theme/theme';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Logger } from '../../utils/logger';
import MessageAttachment from '../../components/MessageAttachment';
import ChatInputBar from '../../components/ChatInputBar';
import MessageActionSheet from '../../components/MessageActionSheet';
import Toast from 'react-native-toast-message';
import { MessagesShimmer } from '../../components/ShimmerPlaceholder';

const TAG = 'PrivateChat';

export default function PrivateChatScreen({ route, navigation }: any) {
  const { chatId, chatName } = route.params;
  const { currentUser, userRole, userName } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Set header title
  useEffect(() => {
    navigation.setOptions({
      title: chatName || 'Chat',
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate('FileViewer', { chatId, chatName })}
        >
          <Ionicons name="document-attach-outline" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, chatName, chatId]);

  // Fetch participant names
  useEffect(() => {
    if (!chatId) return;

    const fetchNames = async () => {
      try {
        const chatDoc = await getDoc(doc(db, 'chats', chatId));
        if (!chatDoc.exists()) return;
        const chatData = chatDoc.data();
        const participantIds = chatData?.users || [];
        const cache: Record<string, string> = {};

        for (const userId of participantIds) {
          if (!userId || userId === 'admin') continue;
          try {
            const studentDoc = await getDoc(doc(db, 'Students', userId));
            if (studentDoc.exists()) {
              const data = studentDoc.data();
              cache[userId] = data?.name || data?.Name || 'Student';
              if (data?.uid) cache[data.uid] = cache[userId];
              continue;
            }
          } catch {}
          try {
            const teacherDoc = await getDoc(doc(db, 'Teacher', userId));
            if (teacherDoc.exists()) {
              const data = teacherDoc.data();
              cache[userId] = data?.name || data?.Name || 'Teacher';
              if (data?.uid) cache[data.uid] = cache[userId];
              continue;
            }
          } catch {}
          cache[userId] = 'User';
        }
        setUserNames(cache);
      } catch (error) {
        Logger.error(TAG, 'Error fetching user names', error);
      }
    };

    fetchNames();
  }, [chatId]);

  // Subscribe to messages (with currentUserId for delete filtering)
  useEffect(() => {
    if (!chatId) return;

    const unsubscribe = subscribeToMessages(chatId, (msgs) => {
      setMessages(msgs);
      setLoading(false);
      
      // Mark messages as read dynamically when inside the chat
      if (currentUser?.uid) {
        markChatAsRead(chatId, currentUser.uid);
      }
    }, currentUser?.uid);

    // Mark as read when entering
    if (currentUser?.uid) {
      markChatAsRead(chatId, currentUser.uid);
    }

    return () => unsubscribe();
  }, [chatId, currentUser?.uid]);

  // Auto-scroll
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  // --- Send Handlers ---
  const handleSendText = useCallback(async (text: string) => {
    if (!currentUser?.uid) return;
    try {
      await sendMessage(
        chatId,
        currentUser.uid,
        userName || currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
        userRole || 'student',
        text
      );
    } catch (error) {
      Logger.error(TAG, 'Error sending message', error);
      Toast.show({ type: 'error', text1: 'Failed to send', text2: 'Please try again.' });
      throw error;
    }
  }, [currentUser, chatId, userName, userRole]);

  const handleSendFile = useCallback(async (file: { uri: string; name: string; mimeType: string; size?: number }) => {
    if (!currentUser?.uid) return;
    setUploading(true);
    try {
      Toast.show({ type: 'info', text1: 'Uploading...', text2: file.name, autoHide: false });
      const uploadResult = await fileService.uploadFile(
        file.uri, file.name, file.mimeType,
        chatId, '', currentUser.email || '',
        userRole || 'student', userName || currentUser.displayName || ''
      );
      Toast.hide();
      await sendFileMessage(chatId, currentUser.uid,
        userName || currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
        userRole || 'student', {
          fileId: String(uploadResult.fileId),
          fileName: uploadResult.filename || file.name,
          fileUrl: fileService.getDownloadUrl(String(uploadResult.fileId)),
          mimeType: file.mimeType,
          fileSize: uploadResult.fileSize || file.size,
        });
      Toast.show({ type: 'success', text1: 'File sent!', text2: uploadResult.filename || file.name });
    } catch (error) {
      Toast.hide();
      Logger.error(TAG, 'Error uploading file', error);
      Toast.show({ type: 'error', text1: 'Upload failed' });
    } finally {
      setUploading(false);
    }
  }, [currentUser, chatId, userName, userRole]);

  const handleSendVoice = useCallback(async (uri: string, duration: number) => {
    if (!currentUser?.uid) return;
    setUploading(true);
    try {
      Toast.show({ type: 'info', text1: 'Sending voice message...', autoHide: false });
      const fileName = `voice_${Date.now()}.m4a`;
      const uploadResult = await fileService.uploadFile(
        uri, fileName, 'audio/m4a',
        chatId, '', currentUser.email || '',
        userRole || 'student', userName || currentUser.displayName || ''
      );
      Toast.hide();
      await sendVoiceMessage(chatId, currentUser.uid,
        userName || currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
        userRole || 'student', {
          fileId: String(uploadResult.fileId),
          fileUrl: fileService.getDownloadUrl(String(uploadResult.fileId)),
          duration, fileName,
        });
      Toast.show({ type: 'success', text1: 'Voice message sent!' });
    } catch (error) {
      Toast.hide();
      Logger.error(TAG, 'Error sending voice message', error);
      Toast.show({ type: 'error', text1: 'Failed to send voice message' });
    } finally {
      setUploading(false);
    }
  }, [currentUser, chatId, userName, userRole]);

  const handleSendImage = useCallback(async (image: { uri: string; name: string; mimeType: string; size?: number }) => {
    if (!currentUser?.uid) return;
    setUploading(true);
    try {
      Toast.show({ type: 'info', text1: 'Sending photo...', autoHide: false });
      const uploadResult = await fileService.uploadFile(
        image.uri, image.name, image.mimeType,
        chatId, '', currentUser.email || '',
        userRole || 'student', userName || currentUser.displayName || ''
      );
      Toast.hide();
      await sendImageMessage(chatId, currentUser.uid,
        userName || currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
        userRole || 'student', {
          fileId: String(uploadResult.fileId),
          fileName: uploadResult.filename || image.name,
          fileUrl: fileService.getDownloadUrl(String(uploadResult.fileId)),
          mimeType: image.mimeType,
          fileSize: uploadResult.fileSize || image.size,
        });
      Toast.show({ type: 'success', text1: 'Photo sent!' });
    } catch (error) {
      Toast.hide();
      Logger.error(TAG, 'Error sending image', error);
      Toast.show({ type: 'error', text1: 'Failed to send photo' });
    } finally {
      setUploading(false);
    }
  }, [currentUser, chatId, userName, userRole]);

  // --- Message long-press ---
  const handleMessageLongPress = useCallback((message: any) => {
    setSelectedMessage(message);
    setShowActionSheet(true);
  }, []);

  const getDisplayName = (message: any): string => {
    if (message.senderId === currentUser?.uid) return 'You';
    const cached = userNames[message.senderId];
    if (cached && cached !== 'User') return cached;
    if (message.senderName && !message.senderName.includes('@')) return message.senderName;
    if (message.senderName?.includes('@')) {
      const prefix = message.senderName.split('@')[0];
      return prefix.charAt(0).toUpperCase() + prefix.slice(1);
    }
    const role = (message.senderRole || '').toLowerCase();
    return role === 'teacher' ? 'Teacher' : role === 'admin' ? 'Admin' : 'User';
  };

  const formatTime = (date: Date | null): string => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateHeader = (date: Date): string => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  };

  const renderMessage = ({ item, index }: { item: any; index: number }) => {
    const isYou = item.senderId === currentUser?.uid;
    const displayName = getDisplayName(item);
    const isFileMessage = (item.messageType === 'file' || item.messageType === 'voice') && item.fileId;
    const isDeletedMessage = item.deletedForEveryone || item.messageType === 'deleted';

    let showDateHeader = false;
    if (index === 0) {
      showDateHeader = true;
    } else {
      const prevMsg = messages[index - 1];
      if (item.timestamp && prevMsg?.timestamp) {
        showDateHeader = item.timestamp.toDateString() !== prevMsg.timestamp.toDateString();
      }
    }

    return (
      <View>
        {showDateHeader && item.timestamp && (
          <View style={styles.dateHeader}>
            <Text style={styles.dateHeaderText}>{formatDateHeader(item.timestamp)}</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.messageRow, isYou ? styles.messageRowSent : styles.messageRowReceived]}
          onLongPress={() => handleMessageLongPress(item)}
          activeOpacity={0.7}
          delayLongPress={300}
        >
          <View style={[styles.messageBubble, isYou ? styles.sentBubble : styles.receivedBubble]}>
            {!isYou && <Text style={styles.senderName}>{displayName}</Text>}

            {/* Deleted message */}
            {isDeletedMessage ? (
              <View style={styles.deletedMessage}>
                <Ionicons name="ban-outline" size={14} color={isYou ? 'rgba(255,255,255,0.6)' : COLORS.textTertiary} />
                <Text style={[styles.deletedText, isYou ? styles.deletedTextSent : styles.deletedTextReceived]}>
                  This message was deleted
                </Text>
              </View>
            ) : (
              <>
                {/* Inline attachment */}
                {isFileMessage && (
                  <MessageAttachment
                    fileId={item.fileId}
                    fileName={item.fileName}
                    fileUrl={item.fileUrl}
                    mimeType={item.mimeType}
                    fileSize={item.fileSize}
                    isSent={isYou}
                    messageType={item.messageType}
                    duration={item.duration}
                  />
                )}

                {/* Text content */}
                {item.text ? (
                  <Text style={[styles.messageText, isYou ? styles.sentText : styles.receivedText]}>
                    {item.text}
                  </Text>
                ) : null}
              </>
            )}

            <View style={styles.messageFooter}>
              <Text style={[styles.messageTime, isYou ? styles.sentTime : styles.receivedTime]}>
                {formatTime(item.timestamp)}
              </Text>
              {isYou && !isDeletedMessage && (
                <Ionicons
                  name={
                    item.readBy?.length > 1 ? "checkmark-done" :
                    item.deliveredTo?.length > 1 ? "checkmark-done" :
                    item.timestamp ? "checkmark" : "time-outline"
                  }
                  size={14}
                  color={item.readBy?.length > 1 ? "#34B7F1" : "rgba(255,255,255,0.7)"}
                  style={{ marginLeft: 4, marginTop: 2 }}
                />
              )}
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <MessagesShimmer />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesContainer}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Ionicons name="chatbubble-ellipses-outline" size={48} color={COLORS.textTertiary} />
            <Text style={styles.emptyChatText}>No messages yet.</Text>
            <Text style={styles.emptyChatSubtext}>Start the conversation!</Text>
          </View>
        }
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {/* WhatsApp-style Input Bar */}
      <ChatInputBar
        onSendText={handleSendText}
        onSendFile={handleSendFile}
        onSendVoice={handleSendVoice}
        onSendImage={handleSendImage}
        uploading={uploading}
      />

      {/* Message Action Sheet */}
      <MessageActionSheet
        visible={showActionSheet}
        message={selectedMessage}
        chatId={chatId}
        currentUserId={currentUser?.uid || ''}
        isBatchChat={false}
        onClose={() => {
          setShowActionSheet(false);
          setSelectedMessage(null);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerButton: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs },
  messagesContainer: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, flexGrow: 1 },
  dateHeader: { alignItems: 'center', marginVertical: SPACING.md },
  dateHeaderText: {
    backgroundColor: 'rgba(18, 125, 142, 0.1)', paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, fontWeight: '500',
  },
  messageRow: { marginBottom: SPACING.xs, maxWidth: '80%' },
  messageRowSent: { alignSelf: 'flex-end' },
  messageRowReceived: { alignSelf: 'flex-start' },
  messageBubble: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.lg },
  sentBubble: { backgroundColor: COLORS.sentBubble, borderBottomRightRadius: SPACING.xs },
  receivedBubble: { backgroundColor: COLORS.receivedBubble, borderBottomLeftRadius: SPACING.xs },
  senderName: { fontSize: FONT_SIZE.xs, fontWeight: '600', color: COLORS.primary, marginBottom: SPACING.xs },
  messageText: { fontSize: FONT_SIZE.md, lineHeight: 20 },
  sentText: { color: COLORS.sentBubbleText },
  receivedText: { color: COLORS.receivedBubbleText },
  messageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: SPACING.xs },
  messageTime: { fontSize: 10 },
  sentTime: { color: 'rgba(255,255,255,0.7)' },
  receivedTime: { color: COLORS.textTertiary },
  // Deleted message
  deletedMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  deletedText: {
    fontSize: FONT_SIZE.sm,
    fontStyle: 'italic',
    marginLeft: SPACING.xs,
  },
  deletedTextSent: { color: 'rgba(255,255,255,0.6)' },
  deletedTextReceived: { color: COLORS.textTertiary },
  // Empty
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 120 },
  emptyChatText: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.text, marginTop: SPACING.md },
  emptyChatSubtext: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.xs },
});
