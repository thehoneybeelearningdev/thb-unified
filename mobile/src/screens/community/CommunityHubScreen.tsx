/**
 * Community Hub Screen — Channel selector for role-based announcements.
 * Shows 3 channels: Teachers, Active Students, All Students.
 * Filtered by user role — admin sees all, teacher sees 'teachers', student sees both student channels.
 */
import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS } from '../../theme/theme';

export type CommunityChannel = 'teachers' | 'activeStudents' | 'allStudents';

interface ChannelInfo {
  key: CommunityChannel;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  visibleTo: string[]; // roles that can see this channel
}

const CHANNELS: ChannelInfo[] = [
  {
    key: 'teachers',
    title: 'Teachers',
    subtitle: 'Announcements for all teachers',
    icon: 'school-outline',
    color: '#3498db',
    visibleTo: ['admin', 'teacher'],
  },
  {
    key: 'activeStudents',
    title: 'Active Students',
    subtitle: 'Announcements for currently enrolled students',
    icon: 'people-outline',
    color: '#2ecc71',
    visibleTo: ['admin', 'student'],
  },
  {
    key: 'allStudents',
    title: 'All Students',
    subtitle: 'Announcements for all students (past & present)',
    icon: 'globe-outline',
    color: '#e67e22',
    visibleTo: ['admin', 'student'],
  },
];

export default function CommunityHubScreen({ navigation }: any) {
  const { userRole } = useAuth();
  const roleLower = (userRole || '').toLowerCase();
  const isAdmin = roleLower === 'admin';

  const visibleChannels = CHANNELS.filter(ch =>
    isAdmin || ch.visibleTo.includes(roleLower)
  );

  const handleChannelPress = (channel: ChannelInfo) => {
    navigation.navigate('ChannelChat', {
      channel: channel.key,
      channelTitle: channel.title,
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerSection}>
        <Ionicons name="megaphone" size={28} color={COLORS.primary} />
        <Text style={styles.headerTitle}>Community</Text>
        <Text style={styles.headerSubtitle}>
          {isAdmin
            ? 'Post announcements to specific groups'
            : 'Stay updated with the latest announcements'}
        </Text>
      </View>

      {visibleChannels.map(channel => (
        <TouchableOpacity
          key={channel.key}
          style={styles.channelCard}
          onPress={() => handleChannelPress(channel)}
          activeOpacity={0.7}
        >
          <View style={[styles.channelIcon, { backgroundColor: channel.color + '18' }]}>
            <Ionicons name={channel.icon} size={26} color={channel.color} />
          </View>
          <View style={styles.channelInfo}>
            <Text style={styles.channelTitle}>{channel.title}</Text>
            <Text style={styles.channelSubtitle}>{channel.subtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
        </TouchableOpacity>
      ))}

      {!isAdmin && (
        <View style={styles.readOnlyNotice}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.textTertiary} />
          <Text style={styles.readOnlyText}>Only admins can post announcements</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.xl },
  headerSection: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
    paddingTop: SPACING.lg,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  headerSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  channelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  channelIcon: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.lg,
  },
  channelInfo: { flex: 1 },
  channelTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  channelSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  readOnlyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.lg,
    padding: SPACING.md,
  },
  readOnlyText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
    marginLeft: SPACING.xs,
  },
});
