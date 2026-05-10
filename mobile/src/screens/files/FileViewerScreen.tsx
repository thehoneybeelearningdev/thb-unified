/**
 * File Viewer Screen — View and manage files for a chat/batch.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { fileService } from '../../services/fileService';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS } from '../../theme/theme';
import { Logger } from '../../utils/logger';
import Toast from 'react-native-toast-message';

const TAG = 'FileViewer';

export default function FileViewerScreen({ route, navigation }: any) {
  const { chatId, chatName } = route.params;
  const { currentUser, userRole } = useAuth();
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    navigation.setOptions({ title: `Files — ${chatName || 'Chat'}` });
  }, [navigation, chatName]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const result = await fileService.getFilesByBatch(chatId);
      setFiles(result?.files || []);
    } catch (error) {
      Logger.error(TAG, 'Error fetching files', error);
      Toast.show({ type: 'error', text1: 'Failed to load files' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [chatId]);

  const handleDownload = async (file: any) => {
    try {
      const url = fileService.getDownloadUrl(file.fileId);
      Toast.show({ type: 'info', text1: 'Downloading...', visibilityTime: 1500 });

      const { downloadWithAuth } = await import('../../utils/useAuthMedia');
      const localUri = await downloadWithAuth(url, file.filename || file.originalName || `file_${file.fileId}`);

      if (!localUri) {
        Toast.show({ type: 'error', text1: 'Download failed', text2: 'File could not be downloaded.' });
        return;
      }

      // Open natively with Android intent viewer
      try {
        const { getContentUriAsync } = await import('expo-file-system/legacy');
        const contentUri = await getContentUriAsync(localUri);
        const IntentLauncher = await import('expo-intent-launcher');
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: file.contentType || '*/*',
        });
        return;
      } catch (intentErr) {
        Logger.error(TAG, 'Intent launch failed, falling back to share', intentErr);
      }

      // Fallback: share sheet
      const Sharing = await import('expo-sharing');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localUri, {
          mimeType: file.contentType || 'application/octet-stream',
          dialogTitle: file.filename || 'Open file',
        });
      }
    } catch (error) {
      Logger.error(TAG, 'Download error', error);
      Toast.show({ type: 'error', text1: 'Failed to download file' });
    }
  };

  const handleDelete = (file: any) => {
    const canDelete =
      userRole?.toLowerCase() === 'admin' ||
      userRole?.toLowerCase() === 'teacher' ||
      file.uploadedBy === currentUser?.email;

    if (!canDelete) {
      Toast.show({ type: 'error', text1: 'Permission denied' });
      return;
    }

    Alert.alert('Delete File', `Delete "${file.filename}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await fileService.deleteFile(file.fileId);
            setFiles(prev => prev.filter(f => f.fileId !== file.fileId));
            Toast.show({ type: 'success', text1: 'File deleted' });
          } catch {
            Toast.show({ type: 'error', text1: 'Failed to delete file' });
          }
        },
      },
    ]);
  };

  const formatSize = (bytes: number): string => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (contentType: string): string => {
    if (contentType?.includes('image')) return 'image-outline';
    if (contentType?.includes('pdf')) return 'document-outline';
    if (contentType?.includes('video')) return 'videocam-outline';
    if (contentType?.includes('audio')) return 'musical-notes-outline';
    return 'document-attach-outline';
  };

  const renderFile = ({ item }: { item: any }) => (
    <View style={styles.fileItem}>
      <View style={styles.fileIconContainer}>
        <Ionicons name={getFileIcon(item.contentType) as any} size={24} color={COLORS.primary} />
      </View>
      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={1}>{item.filename || item.originalName}</Text>
        <Text style={styles.fileMeta}>
          {formatSize(item.fileSize)} • {item.uploadedByName || item.uploadedBy || 'Unknown'}
        </Text>
        {item.uploadDate && (
          <Text style={styles.fileDate}>
            {new Date(item.uploadDate).toLocaleDateString()}
          </Text>
        )}
      </View>
      <TouchableOpacity style={styles.fileAction} onPress={() => handleDownload(item)}>
        <Ionicons name="download-outline" size={20} color={COLORS.primary} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.fileAction} onPress={() => handleDelete(item)}>
        <Ionicons name="trash-outline" size={20} color={COLORS.error} />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return <View style={styles.centerContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={files}
        renderItem={renderFile}
        keyExtractor={(item) => item.fileId}
        contentContainerStyle={files.length === 0 ? styles.emptyContainer : styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={64} color={COLORS.textTertiary} />
            <Text style={styles.emptyTitle}>No Files</Text>
            <Text style={styles.emptySubtitle}>No files have been uploaded yet.</Text>
          </View>
        }
      />

      {/* Upload FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('FileUpload', { chatId, chatName })}
        activeOpacity={0.8}
      >
        <Ionicons name="cloud-upload" size={24} color={COLORS.textInverse} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContainer: { padding: SPACING.md },
  emptyContainer: { flex: 1 },
  fileItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOWS.sm,
  },
  fileIconContainer: {
    width: 44, height: 44, borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryFaded, alignItems: 'center', justifyContent: 'center',
    marginRight: SPACING.md,
  },
  fileInfo: { flex: 1 },
  fileName: { fontSize: FONT_SIZE.md, fontWeight: '500', color: COLORS.text },
  fileMeta: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  fileDate: { fontSize: FONT_SIZE.xs, color: COLORS.textTertiary, marginTop: 1 },
  fileAction: { padding: SPACING.sm },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyTitle: { fontSize: FONT_SIZE.xl, fontWeight: '600', color: COLORS.text, marginTop: SPACING.lg },
  emptySubtitle: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.sm },
  fab: {
    position: 'absolute', bottom: SPACING.xxl, right: SPACING.xl,
    width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', ...SHADOWS.lg,
  },
});
