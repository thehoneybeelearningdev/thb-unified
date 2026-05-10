/**
 * VoiceRecorder — WhatsApp-style voice recording overlay.
 * Tap to start, shows live timer + waveform, swipe left to cancel,
 * pause/resume, delete, and send.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  PanResponder, Dimensions, Vibration,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../theme/theme';
import { Logger } from '../utils/logger';

const TAG = 'VoiceRecorder';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANCEL_THRESHOLD = -100;

interface Props {
  onSend: (uri: string, duration: number) => void;
  onCancel: () => void;
}

export default function VoiceRecorder({ onSend, onCancel }: Props) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isCancelling, setIsCancelling] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slideX = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const lockOpacity = useRef(new Animated.Value(1)).current;

  // Pulse animation for recording indicator
  useEffect(() => {
    if (!isPaused && recording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isPaused, recording]);

  // Start recording on mount
  useEffect(() => {
    startRecording();
    return () => {
      cleanup();
    };
  }, []);

  // Timer
  useEffect(() => {
    if (recording && !isPaused) {
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [recording, isPaused]);

  const cleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Logger.error(TAG, 'Audio permission denied');
        onCancel();
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      Vibration.vibrate(50);
      Logger.info(TAG, 'Recording started');
    } catch (error) {
      Logger.error(TAG, 'Failed to start recording', error);
      onCancel();
    }
  };

  const handlePause = async () => {
    if (!recording) return;
    try {
      if (isPaused) {
        await recording.startAsync();
        setIsPaused(false);
      } else {
        await recording.pauseAsync();
        setIsPaused(true);
      }
    } catch (error) {
      Logger.error(TAG, 'Error pausing/resuming', error);
    }
  };

  const handleSend = async () => {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (uri) {
        onSend(uri, duration);
      }
      setRecording(null);
      cleanup();
    } catch (error) {
      Logger.error(TAG, 'Error sending recording', error);
      onCancel();
    }
  };

  const handleDelete = async () => {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      setRecording(null);
      cleanup();
      onCancel();
    } catch (error) {
      Logger.error(TAG, 'Error deleting recording', error);
      onCancel();
    }
  };

  const handleCancel = async () => {
    Vibration.vibrate(50);
    await handleDelete();
  };

  const formatTime = (seconds: number): string => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  // Pan responder for swipe-to-cancel
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 10,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dx < 0) {
          slideX.setValue(gesture.dx);
          const progress = Math.min(Math.abs(gesture.dx) / Math.abs(CANCEL_THRESHOLD), 1);
          lockOpacity.setValue(1 - progress * 0.7);
          setIsCancelling(gesture.dx < CANCEL_THRESHOLD);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx < CANCEL_THRESHOLD) {
          handleCancel();
        } else {
          Animated.spring(slideX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 10,
          }).start();
          lockOpacity.setValue(1);
          setIsCancelling(false);
        }
      },
    })
  ).current;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateX: slideX }] }]}
      {...panResponder.panHandlers}
    >
      {/* Delete/Trash button */}
      <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
        <Ionicons name="trash-outline" size={22} color={COLORS.error} />
      </TouchableOpacity>

      {/* Recording indicator + timer */}
      <View style={styles.recordingInfo}>
        <Animated.View
          style={[
            styles.recordingDot,
            { transform: [{ scale: pulseAnim }] },
            isPaused && styles.recordingDotPaused,
          ]}
        />
        <Text style={styles.timerText}>{formatTime(duration)}</Text>
      </View>

      {/* Slide to cancel hint */}
      <Animated.View style={[styles.cancelHint, { opacity: lockOpacity }]}>
        <Ionicons name="chevron-back" size={14} color={COLORS.textTertiary} />
        <Text style={[styles.cancelText, isCancelling && styles.cancelTextActive]}>
          {isCancelling ? 'Release to cancel' : 'Slide to cancel'}
        </Text>
      </Animated.View>

      {/* Pause/Resume */}
      <TouchableOpacity style={styles.pauseButton} onPress={handlePause}>
        <Ionicons
          name={isPaused ? 'play' : 'pause'}
          size={20}
          color={COLORS.primary}
        />
      </TouchableOpacity>

      {/* Send */}
      <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
        <Ionicons name="send" size={20} color={COLORS.textInverse} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
  },
  deleteButton: {
    padding: SPACING.sm,
    marginRight: SPACING.xs,
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.error,
    marginRight: SPACING.sm,
  },
  recordingDotPaused: {
    backgroundColor: COLORS.textTertiary,
  },
  timerText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
    minWidth: 40,
  },
  cancelHint: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textTertiary,
    marginLeft: 2,
  },
  cancelTextActive: {
    color: COLORS.error,
    fontWeight: '600',
  },
  pauseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryFaded,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
