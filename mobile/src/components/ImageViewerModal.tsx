/**
 * Image Viewer Modal — Full-screen image viewer.
 * Receives a local file URI (already downloaded with auth) and displays it.
 */
import React from 'react';
import {
  Modal, View, TouchableOpacity, StyleSheet, Image,
  SafeAreaView, Text, Dimensions, StatusBar, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE } from '../theme/theme';
import { Logger } from '../utils/logger';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  visible: boolean;
  imageUrl: string; // local file URI
  fileName?: string;
  onClose: () => void;
}

export default function ImageViewerModal({ visible, imageUrl, fileName, onClose }: Props) {
  if (!visible || !imageUrl) return null;

  const handleShare = async () => {
    try {
      if (Platform.OS === 'android') {
        const { getContentUriAsync } = await import('expo-file-system/legacy');
        const IntentLauncher = await import('expo-intent-launcher');
        const contentUri = await getContentUriAsync(imageUrl);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: 'image/*',
        });
        return;
      }
      // iOS fallback
      const Sharing = await import('expo-sharing');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(imageUrl, { mimeType: 'image/jpeg' });
      }
    } catch (err) {
      Logger.error('ImageViewer', 'Share error', err);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {fileName ? (
            <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text>
          ) : <View style={{ flex: 1 }} />}
          <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
            <Ionicons name="open-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            resizeMode="contain"
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  closeButton: {
    padding: SPACING.sm,
  },
  shareButton: {
    padding: SPACING.sm,
  },
  fileName: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: '#fff',
    fontWeight: '500',
    marginHorizontal: SPACING.sm,
  },
  imageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
});
