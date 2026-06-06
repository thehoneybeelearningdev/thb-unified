/**
 * VoiceRecorder — WhatsApp-style voice recording overlay.
 * Tap to start, shows live timer + waveform, swipe left to cancel,
 * pause/resume, delete, and send.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Dimensions, Vibration, ActivityIndicator
} from 'react-native';
import { useAudioRecorder, useAudioRecorderState, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../theme/theme';
import { Logger } from '../utils/logger';

const TAG = 'VoiceRecorder';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  onSend: (uri: string, duration: number) => Promise<void>;
  onCancel: () => void;
}

export default function VoiceRecorder({ onSend, onCancel }: Props) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);
  
  const [isSending, setIsSending] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const isRecordingActive = state.isRecording;
  const isPaused = !state.isRecording && state.durationMillis > 0;
  const durationSec = Math.floor(state.durationMillis / 1000);

  // Pulse animation for recording indicator
  useEffect(() => {
    if (isRecordingActive && !isSending) {
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
  }, [isRecordingActive, isSending]);

  // Start recording on mount
  useEffect(() => {
    startRecording();
    return () => {
      recorder.stop().catch(() => {});
    };
  }, []);

  const startRecording = async () => {
    try {
      const { status } = await requestRecordingPermissionsAsync();
      if (status !== 'granted') {
        Logger.error(TAG, 'Audio permission denied');
        onCancel();
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
      Vibration.vibrate(50);
      Logger.info(TAG, 'Recording started');
    } catch (error) {
      Logger.error(TAG, 'Failed to start recording', error);
      onCancel();
    }
  };

  const handlePause = () => {
    if (isSending) return;
    try {
      if (isPaused) {
        recorder.record();
      } else {
        recorder.pause();
      }
    } catch (error) {
      Logger.error(TAG, 'Error pausing/resuming', error);
    }
  };

  const handleSend = async () => {
    if (isSending) return;
    setIsSending(true);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (uri) {
        await onSend(uri, durationSec);
      }
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
      <TouchableOpacity style={styles.pauseButton} onPress={handlePause} disabled={isSending}>
        <Ionicons
          name={isPaused ? 'play' : 'pause'}
          size={20}
          color={isSending ? COLORS.textTertiary : COLORS.primary}
        />
      </TouchableOpacity>

      {/* Send */}
      <TouchableOpacity style={[styles.sendButton, isSending && styles.sendButtonDisabled]} onPress={handleSend} disabled={isSending}>
        {isSending ? (
          <ActivityIndicator size="small" color={COLORS.textInverse} />
        ) : (
          <Ionicons name="send" size={20} color={COLORS.textInverse} />
        )}
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
  sendButtonDisabled: {
    backgroundColor: COLORS.textTertiary,
  },
});
