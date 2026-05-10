/**
 * ChatInputBar — WhatsApp-style unified input bar.
 * Attachment (+) → Camera/Gallery/Document, Mic when empty, Send when text present.
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal,
  Pressable, Platform, Animated, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS } from '../theme/theme';
import VoiceRecorder from './VoiceRecorder';
import { Logger } from '../utils/logger';
import Toast from 'react-native-toast-message';

const TAG = 'ChatInputBar';

interface Props {
  onSendText: (text: string) => Promise<void>;
  onSendFile: (file: { uri: string; name: string; mimeType: string; size?: number }) => Promise<void>;
  onSendVoice: (uri: string, duration: number) => Promise<void>;
  onSendImage: (image: { uri: string; name: string; mimeType: string; size?: number }) => Promise<void>;
  sending?: boolean;
  uploading?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInputBar({
  onSendText,
  onSendFile,
  onSendVoice,
  onSendImage,
  sending = false,
  uploading = false,
  disabled = false,
  placeholder = 'Type a message...',
}: Props) {
  const [text, setText] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const hasText = text.trim().length > 0;

  const handleSend = useCallback(async () => {
    if (!hasText || sending || isSending) return;
    const msg = text.trim();
    setText('');
    setIsSending(true);
    try {
      await onSendText(msg);
    } catch {
      setText(msg);
    } finally {
      setIsSending(false);
    }
  }, [text, hasText, sending, isSending, onSendText]);

  const handleAttachFile = useCallback(async () => {
    setShowAttachMenu(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const file = result.assets[0];
      await onSendFile({
        uri: file.uri,
        name: file.name || 'file',
        mimeType: file.mimeType || 'application/octet-stream',
        size: file.size,
      });
    } catch (error) {
      Logger.error(TAG, 'Error picking document', error);
    }
  }, [onSendFile]);

  const handleCamera = useCallback(async () => {
    setShowAttachMenu(false);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({ type: 'error', text1: 'Camera permission required' });
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const image = result.assets[0];
      const fileName = image.fileName || `photo_${Date.now()}.jpg`;
      await onSendImage({
        uri: image.uri,
        name: fileName,
        mimeType: image.mimeType || 'image/jpeg',
        size: image.fileSize,
      });
    } catch (error) {
      Logger.error(TAG, 'Error capturing photo', error);
    }
  }, [onSendImage]);

  const handleGallery = useCallback(async () => {
    setShowAttachMenu(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({ type: 'error', text1: 'Gallery permission required' });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsMultipleSelection: false,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const image = result.assets[0];
      const fileName = image.fileName || `image_${Date.now()}.jpg`;
      await onSendImage({
        uri: image.uri,
        name: fileName,
        mimeType: image.mimeType || 'image/jpeg',
        size: image.fileSize,
      });
    } catch (error) {
      Logger.error(TAG, 'Error picking from gallery', error);
    }
  }, [onSendImage]);

  const handleMicPress = useCallback(() => {
    Keyboard.dismiss();
    setIsRecording(true);
  }, []);

  const handleVoiceSend = useCallback(async (uri: string, duration: number) => {
    setIsRecording(false);
    try {
      await onSendVoice(uri, duration);
    } catch (error) {
      Logger.error(TAG, 'Error sending voice message', error);
      Toast.show({ type: 'error', text1: 'Failed to send voice message' });
    }
  }, [onSendVoice]);

  const handleVoiceCancel = useCallback(() => {
    setIsRecording(false);
  }, []);

  // Voice recording mode
  if (isRecording) {
    return <VoiceRecorder onSend={handleVoiceSend} onCancel={handleVoiceCancel} />;
  }

  return (
    <>
      <View style={styles.container}>
        {/* Attachment button */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => setShowAttachMenu(true)}
          disabled={uploading || disabled}
        >
          <Ionicons
            name="add-circle-outline"
            size={26}
            color={uploading ? COLORS.textTertiary : COLORS.textSecondary}
          />
        </TouchableOpacity>

        {/* Text input */}
        <View style={styles.inputWrapper}>
          <TextInput
            ref={inputRef}
            style={styles.textInput}
            placeholder={placeholder}
            placeholderTextColor={COLORS.textTertiary}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={2000}
            editable={!disabled}
          />
        </View>

        {/* Camera quick button (when no text) */}
        {!hasText && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleCamera}
            disabled={uploading || disabled}
          >
            <Ionicons name="camera-outline" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}

        {/* Mic or Send button */}
        {hasText ? (
          <TouchableOpacity
            style={[styles.sendButton, styles.sendButtonActive]}
            onPress={handleSend}
            disabled={sending || isSending || disabled}
          >
            <Ionicons name="send" size={20} color={COLORS.textInverse} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.sendButton, styles.micButton]}
            onPress={handleMicPress}
            disabled={disabled}
          >
            <Ionicons name="mic" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Attachment Menu Modal */}
      <Modal
        visible={showAttachMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAttachMenu(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setShowAttachMenu(false)}>
          <View style={styles.menuSheet}>
            <View style={styles.menuHandle} />
            <View style={styles.menuGrid}>
              {/* Camera */}
              <TouchableOpacity style={styles.menuItem} onPress={handleCamera}>
                <View style={[styles.menuIcon, { backgroundColor: '#e74c3c20' }]}>
                  <Ionicons name="camera" size={26} color="#e74c3c" />
                </View>
                <Text style={styles.menuLabel}>Camera</Text>
              </TouchableOpacity>

              {/* Gallery */}
              <TouchableOpacity style={styles.menuItem} onPress={handleGallery}>
                <View style={[styles.menuIcon, { backgroundColor: '#9b59b620' }]}>
                  <Ionicons name="images" size={26} color="#9b59b6" />
                </View>
                <Text style={styles.menuLabel}>Gallery</Text>
              </TouchableOpacity>

              {/* Document */}
              <TouchableOpacity style={styles.menuItem} onPress={handleAttachFile}>
                <View style={[styles.menuIcon, { backgroundColor: '#3498db20' }]}>
                  <Ionicons name="document" size={26} color="#3498db" />
                </View>
                <Text style={styles.menuLabel}>Document</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
  },
  iconButton: {
    padding: SPACING.sm,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.xl,
    marginHorizontal: SPACING.xs,
    minHeight: 40,
    maxHeight: 120,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    paddingHorizontal: SPACING.lg,
    paddingVertical: Platform.OS === 'ios' ? SPACING.sm + 2 : SPACING.sm,
    maxHeight: 120,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    backgroundColor: COLORS.primary,
  },
  micButton: {
    backgroundColor: COLORS.primaryFaded,
  },
  // Attachment menu
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingBottom: 34,
    ...SHADOWS.lg,
  },
  menuHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.borderLight,
    alignSelf: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  menuGrid: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.xl,
    justifyContent: 'space-around',
  },
  menuItem: {
    alignItems: 'center',
    width: 80,
  },
  menuIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  menuLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
});
