/**
 * File Upload Screen — Upload files to a chat/batch.
 */
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../../context/AuthContext';
import { fileService } from '../../services/fileService';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS } from '../../theme/theme';
import Toast from 'react-native-toast-message';
import { Logger } from '../../utils/logger';

const TAG = 'FileUpload';

export default function FileUploadScreen({ route, navigation }: any) {
  const { chatId, chatName } = route.params;
  const { currentUser, userRole, userName } = useAuth();
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedFile(result.assets[0]);
      }
    } catch (error) {
      Logger.error(TAG, 'Error picking file', error);
      Toast.show({ type: 'error', text1: 'Failed to pick file' });
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !currentUser) return;

    setUploading(true);
    try {
      await fileService.uploadFile(
        selectedFile.uri,
        selectedFile.name || 'file',
        selectedFile.mimeType || 'application/octet-stream',
        chatId,
        description,
        currentUser.email || '',
        userRole || 'student',
        userName || currentUser.displayName || ''
      );

      Toast.show({ type: 'success', text1: 'File uploaded successfully!' });
      navigation.goBack();
    } catch (error) {
      Logger.error(TAG, 'Error uploading file', error);
      Toast.show({ type: 'error', text1: 'Upload failed', text2: 'Please try again.' });
    } finally {
      setUploading(false);
    }
  };

  const formatSize = (bytes?: number): string => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* File Picker */}
        <TouchableOpacity style={styles.pickerBox} onPress={handlePickFile} activeOpacity={0.7}>
          {selectedFile ? (
            <View style={styles.selectedFileInfo}>
              <Ionicons name="document-attach" size={32} color={COLORS.primary} />
              <View style={styles.fileDetails}>
                <Text style={styles.fileName} numberOfLines={2}>{selectedFile.name}</Text>
                <Text style={styles.fileSize}>{formatSize(selectedFile.size)}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedFile(null)} style={styles.removeButton}>
                <Ionicons name="close-circle" size={24} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.pickerPlaceholder}>
              <Ionicons name="cloud-upload-outline" size={48} color={COLORS.textTertiary} />
              <Text style={styles.pickerText}>Tap to select a file</Text>
              <Text style={styles.pickerSubtext}>Max file size: 50MB</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Description */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Assignment submission, notes..."
            placeholderTextColor={COLORS.textTertiary}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={200}
          />
        </View>

        {/* Upload Target */}
        <View style={styles.targetInfo}>
          <Ionicons name="folder-outline" size={16} color={COLORS.primary} />
          <Text style={styles.targetText}>Uploading to: {chatName || chatId}</Text>
        </View>

        {/* Upload Button */}
        <TouchableOpacity
          style={[styles.uploadButton, (!selectedFile || uploading) && styles.uploadButtonDisabled]}
          onPress={handleUpload}
          disabled={!selectedFile || uploading}
          activeOpacity={0.8}
        >
          {uploading ? (
            <ActivityIndicator color={COLORS.textInverse} />
          ) : (
            <>
              <Ionicons name="cloud-upload" size={20} color={COLORS.textInverse} style={{ marginRight: SPACING.sm }} />
              <Text style={styles.uploadButtonText}>Upload File</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.xl },
  pickerBox: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    borderWidth: 2, borderColor: COLORS.border, borderStyle: 'dashed',
    padding: SPACING.xxl, marginBottom: SPACING.xl, ...SHADOWS.sm,
  },
  pickerPlaceholder: { alignItems: 'center' },
  pickerText: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.text, marginTop: SPACING.md },
  pickerSubtext: { fontSize: FONT_SIZE.xs, color: COLORS.textTertiary, marginTop: SPACING.xs },
  selectedFileInfo: { flexDirection: 'row', alignItems: 'center' },
  fileDetails: { flex: 1, marginLeft: SPACING.md },
  fileName: { fontSize: FONT_SIZE.md, fontWeight: '500', color: COLORS.text },
  fileSize: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  removeButton: { padding: SPACING.sm },
  inputGroup: { marginBottom: SPACING.xl },
  label: { fontSize: FONT_SIZE.sm, fontWeight: '500', color: COLORS.text, marginBottom: SPACING.sm },
  input: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md, color: COLORS.text, minHeight: 60, textAlignVertical: 'top',
  },
  targetInfo: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.primaryFaded, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, marginBottom: SPACING.xl,
  },
  targetText: { fontSize: FONT_SIZE.sm, color: COLORS.primary, marginLeft: SPACING.sm, fontWeight: '500' },
  uploadButton: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', ...SHADOWS.md,
  },
  uploadButtonDisabled: { opacity: 0.5 },
  uploadButtonText: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.textInverse },
});
