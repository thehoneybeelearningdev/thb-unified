/**
 * Chat List Screen — WhatsApp-inspired private chat list.
 * Shows all private chats for the current user with unread badges.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, RefreshControl, AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getUserChats, markChatAsRead, subscribeToUnreadCount } from '../../utils/chatUtils';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS } from '../../theme/theme';
import { Logger } from '../../utils/logger';
import { Unsubscribe, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { showMessageNotification } from '../../utils/localNotifications';

const TAG = 'ChatList';

export default function ChatListScreen({ navigation }: any) {
  const { currentUser, userRole, userName } = useAuth();
  const [chats, setChats] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const prevUnreadRef = useRef<Record<string, number>>({});
  const [paymentStatuses, setPaymentStatuses] = useState<Record<string, { status: string; updatedAt: Date | null }>>({});

  // Subscribe to chats
  useEffect(() => {
    if (!currentUser?.uid || !userRole) return;

    const unsubscribe = getUserChats(
      currentUser.uid,
      currentUser.email || '',
      userRole,
      (userChats) => {
        setChats(userChats);
        setLoading(false);
        setRefreshing(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser, userRole]);

  // Subscribe to unread counts for each chat & trigger local notifications
  useEffect(() => {
    if (!currentUser?.uid || chats.length === 0) return;

    const unsubs: Unsubscribe[] = [];
    chats.forEach(chat => {
      const unsub = subscribeToUnreadCount(chat.id, currentUser.uid, true, (count) => {
        setUnreadCounts(prev => {
          const prevCount = prev[chat.id] || 0;
          // If unread count increased, show a local notification
          if (count > prevCount && prevCount >= 0) {
            const chatDisplayName = chat.name || chat.chatName || 'New Message';
            const preview = chat.lastMessage || 'You have a new message';
            showMessageNotification(chatDisplayName, preview, chat.id, chatDisplayName);
          }
          return { ...prev, [chat.id]: count };
        });
      });
      unsubs.push(unsub);
    });

    return () => { unsubs.forEach(u => u()); };
  }, [chats, currentUser?.uid]);

  // Fetch payment status for private chat participants (for overdue badges)
  useEffect(() => {
    if (chats.length === 0) return;
    const fetchPaymentStatuses = async () => {
      const statusMap: Record<string, { status: string; updatedAt: Date | null }> = {};
      for (const chat of chats) {
        const otherId = chat.otherParticipantId; // Use otherParticipantId as it's the user ID
        if (!otherId || otherId === 'admin') continue;
        try {
          const sDoc = await getDoc(doc(db, 'Students', otherId));
          if (sDoc.exists()) {
            const data = sDoc.data();
            statusMap[otherId] = {
              status: data?.paymentStatus || 'unpaid',
              updatedAt: data?.paymentLastResetAt?.toDate?.() || null,
            };
          }
        } catch (error) {
          Logger.error(TAG, `Error fetching payment status for ${otherId}:`, error);
        }
      }
      setPaymentStatuses(statusMap);
    };
    fetchPaymentStatuses();
  }, [chats]);

  const handleChatPress = useCallback((chat: any) => {
    // Mark as read
    if (currentUser?.uid && chat.id) {
      markChatAsRead(chat.id, currentUser.uid);
    }

    navigation.navigate('PrivateChat', {
      chatId: chat.id,
      chatName: chat.title || 'Chat',
      receiverId: chat.otherParticipantId,
    });
  }, [currentUser, navigation]);

  const filteredChats = chats.filter(chat => {
    const title = (chat.title || chat.name || '').toLowerCase();
    return title.includes(searchTerm.toLowerCase());
  });

  const formatTime = (date: Date | null) => {
    if (!date) return '';
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (isYesterday) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const renderChat = ({ item }: { item: any }) => {
    const initial = (item.title || 'C').charAt(0).toUpperCase();
    const unread = unreadCounts[item.id] || 0;

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => handleChatPress(item)}
        activeOpacity={0.6}
      >
        <View style={[styles.avatar, unread > 0 && styles.avatarUnread]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.chatInfo}>
          <View style={styles.chatTopRow}>
            <Text style={[styles.chatName, unread > 0 && styles.chatNameUnread]} numberOfLines={1}>
              {item.title || 'Chat'}
            </Text>
            <Text style={[styles.chatTime, unread > 0 && styles.chatTimeUnread]}>
              {formatTime(item.lastMessageTime)}
            </Text>
          </View>
          {item.subtitle ? (
            <View style={styles.subtitleRow}>
              <Text style={styles.chatSubtitle} numberOfLines={1}>{item.subtitle}</Text>
              {(() => {
                const ps = paymentStatuses[item.otherParticipantId];
                if (!ps || ps.status === 'paid') return null;
                // Show badge only if 10+ days since reset (1st of month)
                const dayOfMonth = new Date().getDate();
                if (dayOfMonth < 10) return null;
                return (
                  <View style={styles.unpaidBadge}>
                    <Text style={styles.unpaidBadgeText}>Unpaid</Text>
                  </View>
                );
              })()}
            </View>
          ) : null}
          <View style={styles.chatBottomRow}>
            <Text style={styles.chatLastMessage} numberOfLines={1}>
              {item.lastMessage || 'No messages yet'}
            </Text>
            {unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {unread > 99 ? '99+' : unread}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading chats...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={COLORS.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search chats..."
          placeholderTextColor={COLORS.textTertiary}
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
        {searchTerm.length > 0 && (
          <TouchableOpacity onPress={() => setSearchTerm('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Chat List */}
      <FlatList
        data={filteredChats}
        renderItem={renderChat}
        keyExtractor={(item) => item.id}
        contentContainerStyle={filteredChats.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={64} color={COLORS.textTertiary} />
            <Text style={styles.emptyTitle}>No Chats Yet</Text>
            <Text style={styles.emptySubtitle}>
              Your private chats will appear here once assigned.
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => setRefreshing(true)}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    ...SHADOWS.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.sm,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.borderLight,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  avatarUnread: {
    backgroundColor: COLORS.primary,
  },
  avatarText: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '600',
    color: COLORS.primary,
  },
  chatInfo: {
    flex: 1,
  },
  chatTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  chatName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
    color: COLORS.text,
    flex: 1,
    marginRight: SPACING.sm,
  },
  chatNameUnread: {
    fontWeight: '700',
  },
  chatSubtitle: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: '500',
    marginBottom: 2,
    flex: 1,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  unpaidBadge: {
    backgroundColor: '#e74c3c',
    borderRadius: RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: SPACING.sm,
  },
  unpaidBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  chatTime: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
  },
  chatTimeUnread: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  chatBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatLastMessage: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    flex: 1,
    marginRight: SPACING.sm,
  },
  unreadBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xs + 2,
  },
  unreadBadgeText: {
    color: COLORS.textInverse,
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.lg,
  },
  emptySubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    textAlign: 'center',
    paddingHorizontal: SPACING.xxxl,
  },
});
