/**
 * Channel Announcements Screen — shows announcements for a specific community channel.
 * Admin can post; teachers/students are read-only.
 * Accepts `channel` and `channelTitle` route params.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import {
  subscribeToChannelAnnouncements,
  sendChannelAnnouncement,
} from '../../utils/chatUtils';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../../theme/theme';
import { CommunityChannel } from './CommunityHubScreen';
import Toast from 'react-native-toast-message';
import { Logger } from '../../utils/logger';

const TAG = 'ChannelChat';

export default function AnnouncementsScreen({ route, navigation }: any) {
  const { channel, channelTitle } = route?.params || {};
  const { currentUser, userRole, userName } = useAuth();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const isAdmin = userRole?.toLowerCase() === 'admin';
  const resolvedChannel: CommunityChannel = channel || 'allStudents';

  useEffect(() => {
    navigation.setOptions({
      title: channelTitle || 'Announcements',
    });
  }, [navigation, channelTitle]);

  // Subscribe to announcements for this channel
  useEffect(() => {
    Logger.info(TAG, `Subscribing to channel: ${resolvedChannel}`);
    const unsub = subscribeToChannelAnnouncements(resolvedChannel, (msgs) => {
      setAnnouncements(msgs);
      setLoading(false);
    });
    return () => unsub();
  }, [resolvedChannel]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (announcements.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [announcements.length]);

  const handleSend = useCallback(async () => {
    if (!newMessage.trim() || !currentUser?.uid || sending || !isAdmin) return;
    const text = newMessage.trim();
    setNewMessage('');
    setSending(true);
    try {
      await sendChannelAnnouncement(
        resolvedChannel,
        currentUser.uid,
        userName || currentUser.displayName || 'Admin',
        text
      );
      Logger.info(TAG, `Announcement sent to channel: ${resolvedChannel}`);
    } catch (error) {
      Logger.error(TAG, 'Failed to send announcement', error);
      setNewMessage(text);
      Toast.show({ type: 'error', text1: 'Failed to send', text2: 'Please try again.' });
    } finally {
      setSending(false);
    }
  }, [newMessage, currentUser, userName, sending, isAdmin, resolvedChannel]);

  const formatTime = (date: Date | null): string => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateHeader = (date: Date): string => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  };

  const renderAnnouncement = ({ item, index }: { item: any; index: number }) => {
    let showDateHeader = false;
    if (index === 0) showDateHeader = true;
    else {
      const prev = announcements[index - 1];
      if (item.timestamp && prev?.timestamp) {
        showDateHeader = item.timestamp.toDateString() !== prev.timestamp.toDateString();
      }
    }

    return (
      <View>
        {showDateHeader && item.timestamp && (
          <View style={styles.dateHeader}>
            <Text style={styles.dateHeaderText}>{formatDateHeader(item.timestamp)}</Text>
          </View>
        )}
        <View style={styles.announcementCard}>
          <View style={styles.announcementHeader}>
            <Ionicons name="megaphone" size={16} color={COLORS.primary} />
            <Text style={styles.announcementSender}>
              {item.senderName || 'Admin'}
            </Text>
            <Text style={styles.announcementTime}>{formatTime(item.timestamp)}</Text>
          </View>
          <Text style={styles.announcementText}>{item.text}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading announcements...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={announcements}
        renderItem={renderAnnouncement}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="megaphone-outline" size={64} color={COLORS.textTertiary} />
            <Text style={styles.emptyTitle}>No Announcements</Text>
            <Text style={styles.emptySubtitle}>
              {isAdmin
                ? 'Post the first announcement for this channel.'
                : 'No announcements have been posted yet.'}
            </Text>
          </View>
        }
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Admin can post, others see read-only footer */}
      {isAdmin ? (
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder={`Post to ${channelTitle || 'channel'}...`}
            placeholderTextColor={COLORS.textTertiary}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[styles.sendButton, newMessage.trim() ? styles.sendButtonActive : styles.sendButtonInactive]}
            onPress={handleSend}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={COLORS.textInverse} />
            ) : (
              <Ionicons name="send" size={20} color={newMessage.trim() ? COLORS.textInverse : COLORS.textTertiary} />
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.readOnlyFooter}>
          <Ionicons name="lock-closed-outline" size={14} color={COLORS.textTertiary} />
          <Text style={styles.readOnlyText}>Only admins can post announcements</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: SPACING.md, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  listContainer: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, flexGrow: 1 },
  dateHeader: { alignItems: 'center', marginVertical: SPACING.md },
  dateHeaderText: {
    backgroundColor: 'rgba(18, 125, 142, 0.1)', paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, fontWeight: '500',
  },
  announcementCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    marginBottom: SPACING.sm, borderLeftWidth: 3, borderLeftColor: COLORS.primary,
  },
  announcementHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  announcementSender: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.primary, marginLeft: SPACING.sm, flex: 1 },
  announcementTime: { fontSize: FONT_SIZE.xs, color: COLORS.textTertiary },
  announcementText: { fontSize: FONT_SIZE.md, color: COLORS.text, lineHeight: 22 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyTitle: { fontSize: FONT_SIZE.xl, fontWeight: '600', color: COLORS.text, marginTop: SPACING.lg },
  emptySubtitle: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.sm, textAlign: 'center', paddingHorizontal: SPACING.xxl },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface, borderTopWidth: 0.5, borderTopColor: COLORS.border,
  },
  textInput: {
    flex: 1, backgroundColor: COLORS.background, borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg, paddingVertical: Platform.OS === 'ios' ? SPACING.sm + 2 : SPACING.sm,
    fontSize: FONT_SIZE.md, color: COLORS.text, maxHeight: 100, marginRight: SPACING.sm,
  },
  sendButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sendButtonActive: { backgroundColor: COLORS.primary },
  sendButtonInactive: { backgroundColor: COLORS.borderLight },
  readOnlyFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: SPACING.md, backgroundColor: COLORS.surface,
    borderTopWidth: 0.5, borderTopColor: COLORS.border,
  },
  readOnlyText: {
    fontSize: FONT_SIZE.sm, color: COLORS.textTertiary, marginLeft: SPACING.xs,
  },
});
