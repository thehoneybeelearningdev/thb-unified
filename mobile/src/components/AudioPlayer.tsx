/**
 * AudioPlayer — WhatsApp-style inline audio/voice message player.
 * Shows play/pause, waveform visualization, and duration.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
} from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../theme/theme';
import { Logger } from '../utils/logger';
import { auth } from '../config/firebase';

const TAG = 'AudioPlayer';

interface Props {
  fileUrl: string;
  duration?: number; // duration in seconds
  isSent?: boolean;
}

const WAVEFORM_BARS = 28;

export default function AudioPlayer({ fileUrl, duration = 0, isSent = false }: Props) {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const player = useAudioPlayer(localUri || '');
  const status = useAudioPlayerStatus(player);

  const isPlaying = status.playing;
  const position = status.currentTime * 1000;
  const totalDuration = status.duration * 1000 || duration * 1000;

  // Generate consistent random waveform bars based on URL hash
  const waveformBars = useRef(
    Array.from({ length: WAVEFORM_BARS }, (_, i) => {
      const seed = fileUrl.charCodeAt(i % fileUrl.length) || 42;
      return 0.2 + (((seed * (i + 1) * 17) % 100) / 100) * 0.8;
    })
  ).current;

  const formatDuration = (ms: number): string => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const loadAndPlay = useCallback(async () => {
    if (isPlaying) {
      player.pause();
      return;
    }

    if (localUri) {
      if (status.currentTime >= status.duration - 0.1) {
        player.seekTo(0);
      }
      player.play();
      return;
    }

    try {
      setIsLoading(true);
      const { downloadWithAuth } = await import('../utils/useAuthMedia');
      const uri = await downloadWithAuth(fileUrl);
      
      if (!uri) {
        Toast.show({
          type: 'error',
          text1: 'Audio Not Found',
          text2: 'This voice message could not be loaded. Ask the sender to resend.',
          visibilityTime: 4000,
        });
        setIsLoading(false);
        return;
      }

      setLocalUri(uri);
      // Playing is handled in a useEffect below once localUri is set
    } catch (error) {
      Logger.error(TAG, 'Error playing audio', error);
      setIsLoading(false);
      Toast.show({
        type: 'error',
        text1: 'Media Not Found',
        text2: 'This file could not be loaded. Please ask the sender to resend it.',
        visibilityTime: 4000,
      });
    }
  }, [isPlaying, localUri, player, status.currentTime, status.duration, fileUrl]);

  useEffect(() => {
    if (localUri && isLoading) {
      setIsLoading(false);
      player.play();
    }
  }, [localUri, isLoading, player]);

  const progress = totalDuration > 0 ? position / totalDuration : 0;
  const displayDuration = isPlaying || position > 0
    ? formatDuration(position)
    : formatDuration(totalDuration || duration * 1000);

  const primaryColor = isSent ? '#ffffff' : COLORS.primary;
  const mutedColor = isSent ? 'rgba(255,255,255,0.5)' : COLORS.textTertiary;
  const barActiveColor = isSent ? '#ffffff' : COLORS.primary;
  const barInactiveColor = isSent ? 'rgba(255,255,255,0.35)' : 'rgba(18,125,142,0.25)';

  return (
    <View style={styles.container}>
      {/* Play/Pause button */}
      <TouchableOpacity
        style={[styles.playButton, { backgroundColor: isSent ? 'rgba(255,255,255,0.2)' : COLORS.primaryFaded }]}
        onPress={loadAndPlay}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isLoading ? 'hourglass-outline' : isPlaying ? 'pause' : 'play'}
          size={22}
          color={primaryColor}
          style={!isPlaying && !isLoading ? { marginLeft: 2 } : undefined}
        />
      </TouchableOpacity>

      {/* Waveform */}
      <View style={styles.waveformContainer}>
        <View style={styles.waveform}>
          {waveformBars.map((height, i) => {
            const barProgress = i / WAVEFORM_BARS;
            const isActive = barProgress <= progress;
            return (
              <View
                key={i}
                style={[
                  styles.waveformBar,
                  {
                    height: 4 + height * 20,
                    backgroundColor: isActive ? barActiveColor : barInactiveColor,
                  },
                ]}
              />
            );
          })}
        </View>
        <Text style={[styles.durationText, { color: mutedColor }]}>
          {displayDuration}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    minWidth: 200,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  waveformContainer: {
    flex: 1,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    gap: 1.5,
  },
  waveformBar: {
    width: 3,
    borderRadius: 1.5,
    minHeight: 4,
  },
  durationText: {
    fontSize: FONT_SIZE.xs,
    marginTop: 2,
  },
});
