/**
 * Profile Screen — User info, notifications, and settings.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { subscribeToUserNotifications, markNotificationAsRead, Notification } from '../../utils/notificationUtils';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS } from '../../theme/theme';

export default function ProfileScreen({ navigation }: any) {
  const { user, userRole, userName, logout, loading } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (!user?.email) return;
    const unsub = subscribeToUserNotifications(user.email, setNotifications);
    return () => unsub();
  }, [user?.email]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
          } catch {}
        },
      },
    ]);
  };

  const handleNotificationPress = async (notif: Notification) => {
    await markNotificationAsRead(notif.id);
  };

  const roleBadgeColor = {
    Admin: '#e74c3c',
    Teacher: '#3498db',
    Student: '#2ecc71',
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarLargeText}>
            {(userName || user?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.profileName}>{userName || user?.displayName || 'User'}</Text>
        <Text style={styles.profileEmail}>{user?.email || ''}</Text>
        {userRole && (
          <View style={[styles.roleBadge, { backgroundColor: roleBadgeColor[userRole] || COLORS.primary }]}>
            <Text style={styles.roleBadgeText}>{userRole}</Text>
          </View>
        )}
      </View>

      {/* Menu Items */}
      <View style={styles.menuSection}>
        {/* Notifications */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setShowNotifications(!showNotifications)}
        >
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIcon, { backgroundColor: COLORS.warningLight }]}>
              <Ionicons name="notifications-outline" size={20} color={COLORS.warning} />
            </View>
            <Text style={styles.menuItemText}>Notifications</Text>
          </View>
          <View style={styles.menuItemRight}>
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadCount}</Text>
              </View>
            )}
            <Ionicons
              name={showNotifications ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={COLORS.textTertiary}
            />
          </View>
        </TouchableOpacity>

        {/* Notifications List (Expandable) */}
        {showNotifications && (
          <View style={styles.notificationsContainer}>
            {notifications.length === 0 ? (
              <Text style={styles.noNotifText}>No notifications</Text>
            ) : (
              notifications.slice(0, 10).map(notif => (
                <TouchableOpacity
                  key={notif.id}
                  style={[styles.notifItem, !notif.read && styles.notifItemUnread]}
                  onPress={() => handleNotificationPress(notif)}
                >
                  <Text style={styles.notifTitle}>{notif.title}</Text>
                  <Text style={styles.notifMessage} numberOfLines={2}>{notif.message}</Text>
                  <Text style={styles.notifTime}>
                    {notif.createdAt?.toLocaleDateString()} {notif.createdAt?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* About */}
        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIcon, { backgroundColor: COLORS.primaryLight }]}>
              <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.menuItemText}>About TheHoneyBee</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIcon, { backgroundColor: COLORS.errorLight }]}>
              <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
            </View>
            <Text style={[styles.menuItemText, { color: COLORS.error }]}>Sign Out</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* App Version */}
      <Text style={styles.versionText}>TheHoneyBee Mobile v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  contentContainer: { paddingBottom: SPACING.xxxl },
  profileCard: {
    backgroundColor: COLORS.primary, paddingVertical: SPACING.xxxl, paddingHorizontal: SPACING.xl,
    alignItems: 'center',
  },
  avatarLarge: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  avatarLargeText: { fontSize: 32, fontWeight: '700', color: COLORS.textInverse },
  profileName: { fontSize: FONT_SIZE.xxl, fontWeight: '700', color: COLORS.textInverse, marginBottom: SPACING.xs },
  profileEmail: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.7)', marginBottom: SPACING.md },
  roleBadge: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  roleBadgeText: { color: COLORS.textInverse, fontSize: FONT_SIZE.xs, fontWeight: '600', textTransform: 'uppercase' },
  menuSection: {
    marginTop: SPACING.lg, marginHorizontal: SPACING.lg,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, ...SHADOWS.sm, overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: SPACING.lg, paddingHorizontal: SPACING.lg,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.borderLight,
  },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center' },
  menuIcon: {
    width: 36, height: 36, borderRadius: RADIUS.sm,
    alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md,
  },
  menuItemText: { fontSize: FONT_SIZE.md, fontWeight: '500', color: COLORS.text },
  menuItemRight: { flexDirection: 'row', alignItems: 'center' },
  notifBadge: {
    backgroundColor: COLORS.badge, borderRadius: RADIUS.full,
    minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6, marginRight: SPACING.sm,
  },
  notifBadgeText: { color: COLORS.textInverse, fontSize: FONT_SIZE.xs, fontWeight: '700' },
  notificationsContainer: {
    paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md,
    backgroundColor: COLORS.background,
  },
  noNotifText: { fontSize: FONT_SIZE.sm, color: COLORS.textTertiary, textAlign: 'center', paddingVertical: SPACING.lg },
  notifItem: {
    paddingVertical: SPACING.md, borderBottomWidth: 0.5, borderBottomColor: COLORS.borderLight,
  },
  notifItemUnread: { borderLeftWidth: 3, borderLeftColor: COLORS.primary, paddingLeft: SPACING.md },
  notifTitle: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  notifMessage: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginBottom: SPACING.xs },
  notifTime: { fontSize: FONT_SIZE.xs, color: COLORS.textTertiary },
  versionText: {
    textAlign: 'center', fontSize: FONT_SIZE.xs, color: COLORS.textTertiary,
    marginTop: SPACING.xxl, marginBottom: SPACING.lg,
  },
});
