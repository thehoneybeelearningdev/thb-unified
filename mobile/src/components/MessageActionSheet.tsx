/**
 * MessageActionSheet — WhatsApp-style bottom sheet for message actions.
 * Long-press a message → Delete for Me, Delete for Everyone, Copy, Cancel.
 */
import React from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  Pressable, Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS } from '../theme/theme';
import { deleteMessageForMe, deleteMessageForEveryone } from '../utils/chatUtils';
import Toast from 'react-native-toast-message';
import { Logger } from '../utils/logger';

const TAG = 'MessageActions';

interface MessageData {
  id: string;
  text?: string;
  senderId: string;
  timestamp?: Date;
  messageType?: string;
  deletedForEveryone?: boolean;
}

interface Props {
  visible: boolean;
  message: MessageData | null;
  chatId: string;
  currentUserId: string;
  isBatchChat?: boolean;
  onClose: () => void;
}

export default function MessageActionSheet({
  visible,
  message,
  chatId,
  currentUserId,
  isBatchChat = false,
  onClose,
}: Props) {
  if (!message) return null;

  const isOwnMessage = message.senderId === currentUserId;
  const isDeletedMessage = message.deletedForEveryone || message.messageType === 'deleted';

  const handleDeleteForMe = () => {
    Alert.alert(
      'Delete for Me',
      'This message will be deleted for you. Others will still see it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMessageForMe(chatId, message.id, currentUserId, isBatchChat);
              Toast.show({ type: 'success', text1: 'Message deleted' });
            } catch (error) {
              Logger.error(TAG, 'Error deleting for me', error);
              Toast.show({ type: 'error', text1: 'Failed to delete message' });
            }
            onClose();
          },
        },
      ]
    );
  };

  const handleDeleteForEveryone = () => {
    Alert.alert(
      'Delete for Everyone',
      'This message will be deleted for all participants.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete for Everyone',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMessageForEveryone(chatId, message.id, currentUserId, isBatchChat);
              Toast.show({ type: 'success', text1: 'Message deleted for everyone' });
            } catch (error) {
              Logger.error(TAG, 'Error deleting for everyone', error);
              Toast.show({ type: 'error', text1: 'Failed to delete message' });
            }
            onClose();
          },
        },
      ]
    );
  };

  const handleCopy = async () => {
    if (message.text) {
      await Clipboard.setStringAsync(message.text);
      Toast.show({ type: 'success', text1: 'Copied to clipboard' });
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.handle} />

          {/* Copy (only if text exists and not deleted) */}
          {message.text && !isDeletedMessage && (
            <TouchableOpacity style={styles.option} onPress={handleCopy}>
              <Ionicons name="copy-outline" size={22} color={COLORS.text} />
              <Text style={styles.optionText}>Copy</Text>
            </TouchableOpacity>
          )}

          {/* Delete for Me */}
          <TouchableOpacity style={styles.option} onPress={handleDeleteForMe}>
            <Ionicons name="trash-outline" size={22} color={COLORS.error} />
            <Text style={[styles.optionText, styles.deleteText]}>Delete for Me</Text>
          </TouchableOpacity>

          {/* Delete for Everyone (only own messages, not already deleted) */}
          {isOwnMessage && !isDeletedMessage && (
            <TouchableOpacity style={styles.option} onPress={handleDeleteForEveryone}>
              <Ionicons name="trash" size={22} color={COLORS.error} />
              <Text style={[styles.optionText, styles.deleteText]}>Delete for Everyone</Text>
            </TouchableOpacity>
          )}

          {/* Cancel */}
          <TouchableOpacity style={[styles.option, styles.cancelOption]} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingBottom: 34, // Safe area
    ...SHADOWS.lg,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.borderLight,
    alignSelf: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.borderLight,
  },
  optionText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: '500',
    marginLeft: SPACING.lg,
  },
  deleteText: {
    color: COLORS.error,
  },
  cancelOption: {
    justifyContent: 'center',
    borderBottomWidth: 0,
    marginTop: SPACING.xs,
  },
  cancelText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
});
