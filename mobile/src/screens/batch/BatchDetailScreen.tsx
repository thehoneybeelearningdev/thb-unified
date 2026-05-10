/**
 * BatchDetailScreen — Shows batch members with roles (WhatsApp group info style).
 * Accessed by tapping the batch name/header in BatchChatScreen.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../config/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS } from '../../theme/theme';
import { Logger } from '../../utils/logger';

const TAG = 'BatchDetail';

interface Member {
  id: string;
  name: string;
  email: string;
  role: 'teacher' | 'student' | 'admin';
}

export default function BatchDetailScreen({ route, navigation }: any) {
  const { batchId, batchName, teacher, courseName } = route.params;
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [batchData, setBatchData] = useState<any>(null);

  useEffect(() => {
    navigation.setOptions({ title: batchName || 'Batch Info' });
  }, [navigation, batchName]);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        // Fetch batch document
        const batchDoc = await getDoc(doc(db, 'batches', batchId));
        if (!batchDoc.exists()) {
          setLoading(false);
          return;
        }
        const data = batchDoc.data();
        setBatchData(data);

        const memberList: Member[] = [];

        // Resolve teacher
        if (data.teacherId) {
          try {
            const teacherDoc = await getDoc(doc(db, 'Teacher', data.teacherId));
            if (teacherDoc.exists()) {
              const tData = teacherDoc.data();
              memberList.push({
                id: data.teacherId,
                name: tData.name || tData.Name || 'Teacher',
                email: tData.Gmail || tData.email || '',
                role: 'teacher',
              });
            }
          } catch (e) {
            Logger.warn(TAG, 'Error resolving teacher', e);
          }
        }

        // Resolve students
        const studentIds: string[] = Array.isArray(data.students) ? data.students : [];
        for (const studentId of studentIds) {
          if (typeof studentId !== 'string') continue;
          try {
            // Try direct doc lookup
            const studentDoc = await getDoc(doc(db, 'Students', studentId));
            if (studentDoc.exists()) {
              const sData = studentDoc.data();
              memberList.push({
                id: studentId,
                name: sData.name || sData.Name || 'Student',
                email: sData.Gmail || sData.email || '',
                role: 'student',
              });
              continue;
            }
            // Try by uid
            const uidQ = query(collection(db, 'Students'), where('uid', '==', studentId));
            const uidSnap = await getDocs(uidQ);
            if (!uidSnap.empty) {
              const sData = uidSnap.docs[0].data();
              memberList.push({
                id: studentId,
                name: sData.name || sData.Name || 'Student',
                email: sData.Gmail || sData.email || '',
                role: 'student',
              });
              continue;
            }
            // Try by email
            if (studentId.includes('@')) {
              const emailQ = query(collection(db, 'Students'), where('Gmail', '==', studentId.toLowerCase()));
              const emailSnap = await getDocs(emailQ);
              if (!emailSnap.empty) {
                const sData = emailSnap.docs[0].data();
                memberList.push({
                  id: studentId,
                  name: sData.name || sData.Name || 'Student',
                  email: sData.Gmail || sData.email || studentId,
                  role: 'student',
                });
                continue;
              }
            }
            // Fallback
            memberList.push({
              id: studentId,
              name: studentId.includes('@') ? studentId.split('@')[0] : studentId,
              email: studentId.includes('@') ? studentId : '',
              role: 'student',
            });
          } catch (e) {
            Logger.warn(TAG, `Error resolving student ${studentId}`, e);
          }
        }

        setMembers(memberList);
      } catch (error) {
        Logger.error(TAG, 'Error fetching batch members', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [batchId]);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'teacher':
        return { color: '#3498db', label: 'Teacher', icon: 'school' as const };
      case 'admin':
        return { color: '#e74c3c', label: 'Admin', icon: 'shield-checkmark' as const };
      default:
        return { color: '#2ecc71', label: 'Student', icon: 'person' as const };
    }
  };

  const renderMember = ({ item }: { item: Member }) => {
    const badge = getRoleBadge(item.role);
    const initial = item.name.charAt(0).toUpperCase();

    return (
      <View style={styles.memberItem}>
        <View style={[styles.memberAvatar, { backgroundColor: badge.color + '20' }]}>
          <Text style={[styles.memberAvatarText, { color: badge.color }]}>{initial}</Text>
        </View>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName} numberOfLines={1}>{item.name}</Text>
          {item.email ? (
            <Text style={styles.memberEmail} numberOfLines={1}>{item.email}</Text>
          ) : null}
        </View>
        <View style={[styles.roleBadge, { backgroundColor: badge.color + '18' }]}>
          <Ionicons name={badge.icon} size={12} color={badge.color} />
          <Text style={[styles.roleBadgeText, { color: badge.color }]}>{badge.label}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading members...</Text>
      </View>
    );
  }

  const teacherCount = members.filter(m => m.role === 'teacher').length;
  const studentCount = members.filter(m => m.role === 'student').length;

  return (
    <View style={styles.container}>
      {/* Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.headerAvatar}>
          <Ionicons name="people" size={36} color={COLORS.primary} />
        </View>
        <Text style={styles.headerTitle}>{batchName || 'Batch'}</Text>
        {courseName ? <Text style={styles.headerCourse}>{courseName}</Text> : null}
        {teacher ? (
          <View style={styles.teacherRow}>
            <Ionicons name="school-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.teacherText}>Teacher: {teacher}</Text>
          </View>
        ) : null}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{members.length}</Text>
          <Text style={styles.statLabel}>Members</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#3498db' }]}>{teacherCount}</Text>
          <Text style={styles.statLabel}>Teachers</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#2ecc71' }]}>{studentCount}</Text>
          <Text style={styles.statLabel}>Students</Text>
        </View>
      </View>

      {/* Members List */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {members.length} Participant{members.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <FlatList
        data={members}
        renderItem={renderMember}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={COLORS.textTertiary} />
            <Text style={styles.emptyText}>No members found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centerContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background,
  },
  loadingText: { marginTop: SPACING.md, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },

  // Header card
  headerCard: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
  },
  headerAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.textInverse,
    marginBottom: SPACING.xs,
  },
  headerCourse: {
    fontSize: FONT_SIZE.sm,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: SPACING.sm,
  },
  teacherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  teacherText: {
    fontSize: FONT_SIZE.xs,
    color: 'rgba(255,255,255,0.9)',
    marginLeft: SPACING.xs,
    fontWeight: '500',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  statNumber: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Members
  sectionHeader: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.xs,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  memberAvatarText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
  },
  memberInfo: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  memberName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  memberEmail: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  roleBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    marginLeft: 3,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textTertiary,
    marginTop: SPACING.md,
  },
});
