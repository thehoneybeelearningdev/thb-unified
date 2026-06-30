/**
 * MessageAttachment — Renders inline file/image/video attachments in chat bubbles.
 * All media is downloaded with auth headers and viewed natively in-app.
 * Mimics WhatsApp-style inline media display.
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, Dimensions, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../theme/theme';
import { fileService } from '../services/fileService';
import ImageViewerModal from './ImageViewerModal';
import AudioPlayer from './AudioPlayer';
import Toast from 'react-native-toast-message';
import { Logger } from '../utils/logger';
import { useAuthMedia, downloadWithAuth } from '../utils/useAuthMedia';
import { getContentUriAsync } from 'expo-file-system/legacy';

const TAG = 'Attachment';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_IMAGE_WIDTH = SCREEN_WIDTH * 0.6;
const MAX_IMAGE_HEIGHT = 280;

interface Props {
  fileId: string;
  fileName: string;
  fileUrl?: string;
  mimeType: string;
  fileSize?: number;
  isSent?: boolean;
  messageType?: string;
  duration?: number;
}

export default function MessageAttachment({
  fileId,
  fileName,
  fileUrl,
  mimeType,
  fileSize,
  isSent = false,
  messageType,
  duration,
}: Props) {
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const downloadUrl = fileUrl || fileService.getDownloadUrl(fileId);
  const isImage = mimeType?.startsWith('image/');
  const isVideo = mimeType?.startsWith('video/');
  const isAudio = mimeType?.startsWith('audio/');
  const isVoice = messageType === 'voice';

  // Pre-download media with auth for images
  const { localUri: imageLocalUri, loading: imageLoading, error: imageError } = useAuthMedia(
    isImage && !isVoice ? downloadUrl : undefined
  );

  // --- Voice Message (WhatsApp-style) ---
  if (isVoice) {
    return <AudioPlayer fileUrl={downloadUrl} duration={duration || 0} isSent={isSent} />;
  }

  const formatSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  /**
   * Download and open a file natively using Android's intent system.
   */
  const handleDownloadAndOpen = useCallback(async () => {
    try {
      setDownloading(true);
      Toast.show({ type: 'info', text1: 'Downloading...', visibilityTime: 1500 });

      const localUri = await downloadWithAuth(downloadUrl, fileName || `file_${fileId}`);
      if (!localUri) {
        Toast.show({
          type: 'error',
          text1: 'File Not Found',
          text2: 'This attachment could not be loaded. Ask the sender to resend.',
          visibilityTime: 4000,
        });
        return;
      }

      // Get content URI and open with native viewer
      if (Platform.OS === 'android') {
        try {
          const contentUri = await getContentUriAsync(localUri);
          const IntentLauncher = await import('expo-intent-launcher');
          await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: contentUri,
            flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
            type: mimeType || '*/*',
          });
          return;
        } catch (intentError) {
          Logger.error(TAG, 'Intent launch failed, falling back to share', intentError);
        }
      }

      // Fallback: share sheet
      const Sharing = await import('expo-sharing');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localUri, {
          mimeType: mimeType || 'application/octet-stream',
          dialogTitle: fileName || 'Open file',
        });
      }
    } catch (error) {
      Logger.error(TAG, 'Failed to download/open file', error);
      Toast.show({
        type: 'error',
        text1: 'File Not Found',
        text2: 'This attachment could not be loaded. Ask the sender to resend.',
        visibilityTime: 4000,
      });
    } finally {
      setDownloading(false);
    }
  }, [downloadUrl, fileName, fileId, mimeType]);

  // --- Image Attachment (loaded from local cache) ---
  if (isImage) {
    if (imageLoading) {
      return (
        <View style={styles.imagePlaceholder}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      );
    }

    if (imageError || !imageLocalUri) {
      return (
        <View style={styles.imagePlaceholder}>
          <Ionicons name="image-outline" size={28} color={COLORS.textTertiary} />
          <Text style={styles.errorSmallText}>Image unavailable</Text>
        </View>
      );
    }

    return (
      <>
        <TouchableOpacity
          style={styles.imageContainer}
          onPress={() => setImageViewerVisible(true)}
          activeOpacity={0.85}
        >
          <Image
            source={{ uri: imageLocalUri }}
            style={styles.inlineImage}
            resizeMode="cover"
          />
          {fileName && (
            <Text
              style={[styles.imageCaption, isSent ? styles.captionSent : styles.captionReceived]}
              numberOfLines={1}
            >
              {fileName}
            </Text>
          )}
        </TouchableOpacity>

        <ImageViewerModal
          visible={imageViewerVisible}
          imageUrl={imageLocalUri}
          fileName={fileName}
          onClose={() => setImageViewerVisible(false)}
        />
      </>
    );
  }

  // --- Video Attachment (inline native player) ---
  if (isVideo) {
    return (
      <View style={styles.videoContainer}>
        <VideoInlinePlayer
          downloadUrl={downloadUrl}
          fileName={fileName}
          fileSize={fileSize}
          isSent={isSent}
          formatSize={formatSize}
        />
      </View>
    );
  }

  // --- Audio Attachment (use AudioPlayer for all audio) ---
  if (isAudio) {
    return <AudioPlayer fileUrl={downloadUrl} duration={duration || 0} isSent={isSent} />;
  }

  // --- Generic File Attachment (download & open natively) ---
  return (
    <TouchableOpacity style={styles.fileCard} onPress={handleDownloadAndOpen} activeOpacity={0.7}>
      <View style={styles.fileIconBox}>
        {downloading ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <Ionicons name={getFileIcon(mimeType)} size={22} color={COLORS.primary} />
        )}
      </View>
      <View style={styles.fileInfo}>
        <Text
          style={[styles.fileNameText, isSent ? styles.textSent : styles.textReceived]}
          numberOfLines={2}
        >
          {fileName || 'File'}
        </Text>
        {fileSize ? (
          <Text style={[styles.fileSizeText, isSent ? styles.textSentMuted : styles.textReceivedMuted]}>
            {formatSize(fileSize)}
          </Text>
        ) : null}
      </View>
      <Ionicons
        name={downloading ? 'hourglass-outline' : 'open-outline'}
        size={18}
        color={isSent ? 'rgba(255,255,255,0.7)' : COLORS.primary}
      />
    </TouchableOpacity>
  );
}

/**
 * Inline video player — downloads with auth, then plays natively.
 */
function VideoInlinePlayer({
  downloadUrl,
  fileName,
  fileSize,
  isSent,
  formatSize,
}: {
  downloadUrl: string;
  fileName: string;
  fileSize?: number;
  isSent: boolean;
  formatSize: (b?: number) => string;
}) {
  const [playing, setPlaying] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const { localUri, loading, error } = useAuthMedia(playing ? downloadUrl : undefined);

  const player = useVideoPlayer(localUri);

  React.useEffect(() => {
    if (localUri) {
      player.replace(localUri);
      player.play();
    }
  }, [localUri, player]);

  if (videoError || error) {
    return (
      <View style={videoStyles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={32} color={COLORS.textTertiary} />
        <Text style={videoStyles.errorText}>Video unavailable</Text>
        <Text style={videoStyles.errorSubtext}>Ask the sender to resend</Text>
      </View>
    );
  }

  if (!playing) {
    return (
      <TouchableOpacity
        style={videoStyles.posterContainer}
        onPress={() => setPlaying(true)}
        activeOpacity={0.8}
      >
        <View style={videoStyles.playCircle}>
          <Ionicons name="play" size={28} color="#fff" style={{ marginLeft: 3 }} />
        </View>
        <Text
          style={[videoStyles.label, isSent ? styles.captionSent : styles.captionReceived]}
          numberOfLines={1}
        >
          🎬 {fileName || 'Video'}
        </Text>
        {fileSize ? (
          <Text style={[videoStyles.sizeLabel, isSent ? styles.captionSent : styles.captionReceived]}>
            {formatSize(fileSize)}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  }

  if (loading || !localUri) {
    return (
      <View style={videoStyles.posterContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={videoStyles.label}>Loading video...</Text>
      </View>
    );
  }

  return (
    <View style={videoStyles.playerContainer}>
      <VideoView
        style={videoStyles.player}
        player={player}
        allowsPictureInPicture
        nativeControls
      />
    </View>
  );
}

function getFileIcon(mimeType: string): keyof typeof Ionicons.glyphMap {
  if (mimeType?.includes('pdf')) return 'document-text-outline';
  if (mimeType?.includes('word') || mimeType?.includes('document')) return 'document-outline';
  if (mimeType?.includes('sheet') || mimeType?.includes('excel')) return 'grid-outline';
  if (mimeType?.includes('presentation') || mimeType?.includes('powerpoint')) return 'easel-outline';
  if (mimeType?.includes('zip') || mimeType?.includes('archive')) return 'archive-outline';
  return 'document-attach-outline';
}

const styles = StyleSheet.create({
  imageContainer: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    marginBottom: SPACING.xs,
  },
  imagePlaceholder: {
    width: MAX_IMAGE_WIDTH,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: RADIUS.md,
  },
  inlineImage: {
    width: MAX_IMAGE_WIDTH,
    height: MAX_IMAGE_HEIGHT,
    borderRadius: RADIUS.md,
  },
  imageCaption: {
    fontSize: FONT_SIZE.xs,
    marginTop: 2,
    paddingHorizontal: 2,
  },
  captionSent: { color: 'rgba(255,255,255,0.7)' },
  captionReceived: { color: COLORS.textSecondary },
  errorSmallText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
    marginTop: SPACING.xs,
  },
  videoContainer: {
    width: MAX_IMAGE_WIDTH,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(0,0,0,0.15)',
    overflow: 'hidden',
    marginBottom: SPACING.xs,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    minWidth: 180,
  },
  fileIconBox: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryFaded,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  fileInfo: { flex: 1, marginRight: SPACING.sm },
  fileNameText: { fontSize: FONT_SIZE.sm, fontWeight: '500' },
  fileSizeText: { fontSize: FONT_SIZE.xs, marginTop: 1 },
  textSent: { color: COLORS.textInverse },
  textReceived: { color: COLORS.text },
  textSentMuted: { color: 'rgba(255,255,255,0.6)' },
  textReceivedMuted: { color: COLORS.textTertiary },
});

const videoStyles = StyleSheet.create({
  posterContainer: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: FONT_SIZE.xs,
    marginTop: SPACING.sm,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  sizeLabel: {
    fontSize: FONT_SIZE.xs,
    marginTop: 2,
  },
  playerContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  player: { width: '100%', height: '100%' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 1,
  },
  errorContainer: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  errorText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginTop: SPACING.sm,
  },
  errorSubtext: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
});
