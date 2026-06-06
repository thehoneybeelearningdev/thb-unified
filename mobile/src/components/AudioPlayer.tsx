/**
 * AudioPlayer — WhatsApp-style inline audio/voice message player.
 * Shows play/pause, waveform visualization, and duration.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
} from 'react-native';
import { Audio } from '../utils/expoAvMock';
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

let activeSound: Audio.Sound | null = null;
let activePauseCallback: (() => void) | null = null;

export default function AudioPlayer({ fileUrl, duration = 0, isSent = false }: Props) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration * 1000);
  const [isLoading, setIsLoading] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Generate consistent random waveform bars based on URL hash
  const waveformBars = useRef(
    Array.from({ length: WAVEFORM_BARS }, (_, i) => {
      const seed = fileUrl.charCodeAt(i % fileUrl.length) || 42;
      return 0.2 + (((seed * (i + 1) * 17) % 100) / 100) * 0.8;
    })
  ).current;

  useEffect(() => {
    return () => {
      if (sound) {
        if (activeSound === sound) {
          activeSound = null;
          activePauseCallback = null;
        }
        sound.unloadAsync().catch(() => {});
      }
    };
  }, [sound]);

  const formatDuration = (ms: number): string => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const loadAndPlay = useCallback(async () => {
    try {
      // Stop previously playing audio if it's not this one
      if (activeSound && activeSound !== sound && activePauseCallback) {
        activePauseCallback();
      }

      if (sound) {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await sound.pauseAsync();
            setIsPlaying(false);
            if (activeSound === sound) {
              activeSound = null;
              activePauseCallback = null;
            }
          } else {
            // If at the end, replay
            if (status.positionMillis >= (status.durationMillis || 0) - 100) {
              await sound.setPositionAsync(0);
            }
            await sound.playAsync();
            setIsPlaying(true);
            activeSound = sound;
            activePauseCallback = () => {
              sound.pauseAsync().catch(() => {});
              setIsPlaying(false);
            };
          }
          return;
        }
      }

      setIsLoading(true);
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      // Download the audio file with auth headers to local cache first
      const { downloadWithAuth } = await import('../utils/useAuthMedia');
      const localUri = await downloadWithAuth(fileUrl);
      
      if (!localUri) {
        Toast.show({
          type: 'error',
          text1: 'Audio Not Found',
          text2: 'This voice message could not be loaded. Ask the sender to resend.',
          visibilityTime: 4000,
        });
        setIsLoading(false);
        return;
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: localUri },
        { shouldPlay: true },
        (status: any) => {
          if (status.isLoaded) {
            setPosition(status.positionMillis);
            if (status.durationMillis) {
              setTotalDuration(status.durationMillis);
            }
            const dur = status.durationMillis || totalDuration || 1;
            const progress = dur > 0 ? status.positionMillis / dur : 0;
            progressAnim.setValue(progress);

            if (status.didJustFinish) {
              setIsPlaying(false);
              progressAnim.setValue(0);
              setPosition(0);
              if (activeSound === newSound) {
                activeSound = null;
                activePauseCallback = null;
              }
            }
          }
        }
      );

      setSound(newSound);
      setIsPlaying(true);
      setIsLoading(false);
      
      activeSound = newSound;
      activePauseCallback = () => {
        newSound.pauseAsync().catch(() => {});
        setIsPlaying(false);
      };
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
  }, [sound, fileUrl, totalDuration]);

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
