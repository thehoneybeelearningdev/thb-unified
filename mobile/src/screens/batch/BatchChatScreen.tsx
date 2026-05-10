/**
 * Batch Chat Screen — Group broadcast messaging with WhatsApp-style features.
 * Voice recording, camera capture, message long-press delete, tappable batch header.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import {
  subscribeToBatchMessages, sendBatchMessage,
  sendBatchFileMessage, sendBatchVoiceMessage, sendBatchImageMessage,
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

const TAG = 'BatchChat';

export default function BatchChatScreen({ route, navigation }: any) {
  const { batchId, batchName, teacher, studentsCount, courseName } = route.params;
  const { currentUser, userRole, userName } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [studentNames, setStudentNames] = useState<Record<string, string>>({});
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    navigation.setOptions({
      title: batchName || 'Batch Chat',
      headerRight: () => (
        <TouchableOpacity
          style={{ paddingHorizontal: SPACING.md }}
          onPress={() => navigation.navigate('FileViewer', { chatId: batchId, chatName: batchName })}
        >
          <Ionicons name="document-attach-outline" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, batchName]);

  // Fetch student names for display
  useEffect(() => {
    const fetchNames = async () => {
      try {
        const batchDoc = await getDoc(doc(db, 'batches', batchId));
        if (!batchDoc.exists()) return;
        const data = batchDoc.data();
        const studentIds = data?.students || [];
        const cache: Record<string, string> = {};

        for (const studentId of studentIds) {
          if (typeof studentId !== 'string') continue;
          try {
            const sDoc = await getDoc(doc(db, 'Students', studentId));
            if (sDoc.exists()) {
              const sData = sDoc.data();
              cache[studentId] = sData?.name || sData?.Name || 'Student';
              if (sData?.uid) cache[sData.uid] = cache[studentId];
            }
          } catch {}
        }
        setStudentNames(cache);
      } catch (error) {
        Logger.error(TAG, 'Error fetching student names', error);
      }
    };
    fetchNames();
  }, [batchId]);

  // Subscribe to messages (with currentUserId for delete filtering)
  useEffect(() => {
    const unsub = subscribeToBatchMessages(batchId, (msgs) => {
      setMessages(msgs);
      setLoading(false);
    }, currentUser?.uid);
    return () => unsub();
  }, [batchId, currentUser?.uid]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  // --- Send Handlers ---
  const handleSendText = useCallback(async (text: string) => {
    if (!currentUser?.uid) return;
    try {
      await sendBatchMessage(
        batchId,
        currentUser.uid,
        userName || currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
        userRole || 'student',
        text
      );
    } catch (error) {
      Logger.error(TAG, 'Error sending batch message', error);
      Toast.show({ type: 'error', text1: 'Failed to send message' });
      throw error;
    }
  }, [currentUser, batchId, userName, userRole]);

  const handleSendFile = useCallback(async (file: { uri: string; name: string; mimeType: string; size?: number }) => {
    if (!currentUser?.uid) return;
    setUploading(true);
    try {
      Toast.show({ type: 'info', text1: 'Uploading...', text2: file.name, autoHide: false });
      const uploadResult = await fileService.uploadFile(
        file.uri, file.name, file.mimeType,
        batchId, '', currentUser.email || '',
        userRole || 'student', userName || currentUser.displayName || ''
      );
      Toast.hide();
      await sendBatchFileMessage(batchId, currentUser.uid,
        userName || currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
        userRole || 'student', {
          fileId: String(uploadResult.fileId),
          fileName: uploadResult.filename || file.name,
          fileUrl: fileService.getDownloadUrl(String(uploadResult.fileId)),
          mimeType: file.mimeType,
          fileSize: uploadResult.fileSize || file.size,
        });
      Toast.show({ type: 'success', text1: 'File sent!' });
    } catch (error) {
      Toast.hide();
      Logger.error(TAG, 'Error uploading file', error);
      Toast.show({ type: 'error', text1: 'Upload failed' });
    } finally {
      setUploading(false);
    }
  }, [currentUser, batchId, userName, userRole]);

  const handleSendVoice = useCallback(async (uri: string, duration: number) => {
    if (!currentUser?.uid) return;
    setUploading(true);
    try {
      Toast.show({ type: 'info', text1: 'Sending voice message...', autoHide: false });
      const fileName = `voice_${Date.now()}.m4a`;
      const uploadResult = await fileService.uploadFile(
        uri, fileName, 'audio/m4a',
        batchId, '', currentUser.email || '',
        userRole || 'student', userName || currentUser.displayName || ''
      );
      Toast.hide();
      await sendBatchVoiceMessage(batchId, currentUser.uid,
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
  }, [currentUser, batchId, userName, userRole]);

  const handleSendImage = useCallback(async (image: { uri: string; name: string; mimeType: string; size?: number }) => {
    if (!currentUser?.uid) return;
    setUploading(true);
    try {
      Toast.show({ type: 'info', text1: 'Sending photo...', autoHide: false });
      const uploadResult = await fileService.uploadFile(
        image.uri, image.name, image.mimeType,
        batchId, '', currentUser.email || '',
        userRole || 'student', userName || currentUser.displayName || ''
      );
      Toast.hide();
      await sendBatchImageMessage(batchId, currentUser.uid,
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
  }, [currentUser, batchId, userName, userRole]);

  // --- Message long-press ---
  const handleMessageLongPress = useCallback((message: any) => {
    setSelectedMessage(message);
    setShowActionSheet(true);
  }, []);

  // --- Navigate to batch detail ---
  const handleBatchInfoPress = useCallback(() => {
    navigation.navigate('BatchDetail', {
      batchId,
      batchName,
      teacher,
      courseName,
    });
  }, [navigation, batchId, batchName, teacher, courseName]);

  const getDisplayName = (msg: any): string => {
    if (msg.senderId === currentUser?.uid) return 'You';
    const cached = studentNames[msg.senderId];
    if (cached) return cached;
    if (msg.senderName && !msg.senderName.includes('@')) return msg.senderName;
    const role = (msg.senderRole || '').toLowerCase();
    return role === 'teacher' ? 'Teacher' : role === 'admin' ? 'Admin' : 'User';
  };

  const formatTime = (date: Date | null): string => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
      const prev = messages[index - 1];
      if (item.timestamp && prev?.timestamp) {
        showDateHeader = item.timestamp.toDateString() !== prev.timestamp.toDateString();
      }
    }

    return (
      <View>
        {showDateHeader && item.timestamp && (
          <View style={styles.dateHeader}>
            <Text style={styles.dateHeaderText}>
              {item.timestamp.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
            </Text>
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
                  <Text style={[styles.messageText, isYou ? styles.sentText : styles.receivedText]}>{item.text}</Text>
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
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Batch Info Banner — Tappable to open BatchDetail */}
      <TouchableOpacity
        style={styles.infoBanner}
        onPress={handleBatchInfoPress}
        activeOpacity={0.7}
      >
        <View style={styles.infoRow}>
          <Ionicons name="person" size={14} color={COLORS.primary} />
          <Text style={styles.infoText}>{teacher}</Text>
          <Text style={styles.infoDot}>•</Text>
          <Ionicons name="people" size={14} color={COLORS.primary} />
          <Text style={styles.infoText}>{studentsCount} students</Text>
          {courseName ? (
            <>
              <Text style={styles.infoDot}>•</Text>
              <Text style={styles.infoText}>{courseName}</Text>
            </>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} style={{ marginLeft: 'auto' }} />
      </TouchableOpacity>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesContainer}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Ionicons name="megaphone-outline" size={48} color={COLORS.textTertiary} />
            <Text style={styles.emptyChatText}>No messages yet</Text>
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
        chatId={batchId}
        currentUserId={currentUser?.uid || ''}
        isBatchChat={true}
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
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: SPACING.md, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  infoBanner: {
    backgroundColor: COLORS.primaryFaded,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', flex: 1 },
  infoText: { fontSize: FONT_SIZE.xs, color: COLORS.primary, marginLeft: 4, fontWeight: '500' },
  infoDot: { fontSize: FONT_SIZE.xs, color: COLORS.textTertiary, marginHorizontal: SPACING.xs },
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
