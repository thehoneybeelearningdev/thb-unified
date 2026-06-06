/**
 * Manage Students Screen — Admin-only student list with payment status management.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, Alert, RefreshControl, Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS } from '../../theme/theme';
import { Logger } from '../../utils/logger';
import Toast from 'react-native-toast-message';
import { apiClient } from '../../services/apiClient';
import { StudentListShimmer } from '../../components/ShimmerPlaceholder';

const TAG = 'ManageStudents';

interface Student {
  id: string;
  name: string;
  email: string;
  phone: string;
  paymentStatus: 'paid' | 'unpaid';
  paymentStatusUpdatedAt: string | null;
  batchIds: string[];
  batchNames: string[];
  isActive: boolean;
}

interface StudentAnalytics {
  student: any;
  enrollments: any[];
  batches: any[];
}

export default function ManageStudentsScreen({ navigation }: any) {
  const { userRole } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [toggling, setToggling] = useState<string | null>(null);
  const [analyticsModal, setAnalyticsModal] = useState<StudentAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const fetchStudents = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/students/list');
      setStudents(response.students || []);
    } catch (error: any) {
      Logger.error(TAG, 'Error fetching students', error);
      Toast.show({ type: 'error', text1: 'Failed to load students', text2: error?.message || '' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  // Filter & search
  useEffect(() => {
    let result = students;
    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(s => statusFilter === 'active' ? s.isActive !== false : s.isActive === false);
    }
    // Payment filter
    if (filter !== 'all') {
      result = result.filter(s => s.paymentStatus === filter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.batchNames.some(b => b.toLowerCase().includes(q))
      );
    }
    setFilteredStudents(result);
  }, [students, filter, statusFilter, searchQuery]);

  const togglePayment = (student: Student) => {
    const newStatus = student.paymentStatus === 'paid' ? 'unpaid' : 'paid';
    Alert.alert(
      `Mark as ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}?`,
      `Change ${student.name}'s payment status to "${newStatus}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setToggling(student.id);
            try {
              await apiClient.patch(`/api/students/${student.id}/payment-status`, { status: newStatus });
              setStudents(prev =>
                prev.map(s => s.id === student.id ? { ...s, paymentStatus: newStatus } : s)
              );
              Toast.show({ type: 'success', text1: 'Updated', text2: `${student.name} marked as ${newStatus}` });
            } catch (error: any) {
              Logger.error(TAG, 'Error toggling payment', error);
              Toast.show({ type: 'error', text1: 'Failed', text2: error?.message || '' });
            } finally {
              setToggling(null);
            }
          },
        },
      ]
    );
  };

  const openAnalytics = async (student: Student) => {
    setAnalyticsLoading(true);
    setAnalyticsModal({ student: { ...student }, enrollments: [], batches: [] });
    try {
      const data = await apiClient.get(`/api/students/${student.id}/analytics`);
      setAnalyticsModal(data);
    } catch (error: any) {
      Logger.error(TAG, 'Error fetching analytics', error);
      Toast.show({ type: 'error', text1: 'Failed to load analytics' });
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const paidCount = students.filter(s => s.paymentStatus === 'paid').length;
  const unpaidCount = students.filter(s => s.paymentStatus === 'unpaid').length;
  const activeCount = students.filter(s => s.isActive !== false).length;
  const inactiveCount = students.filter(s => s.isActive === false).length;

  const renderStudent = ({ item }: { item: Student }) => {
    const isPaid = item.paymentStatus === 'paid';
    const isToggling = toggling === item.id;

    return (
      <TouchableOpacity
        style={styles.studentCard}
        onPress={() => openAnalytics(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.avatar, isPaid ? styles.avatarPaid : styles.avatarUnpaid]}>
          <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.studentInfo}>
          <Text style={styles.studentName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.studentEmail} numberOfLines={1}>{item.email}</Text>
          {item.batchNames.length > 0 && (
            <Text style={styles.batchText} numberOfLines={1}>
              {item.batchNames.join(', ')}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.statusBadge, isPaid ? styles.badgePaid : styles.badgeUnpaid]}
          onPress={() => togglePayment(item)}
          disabled={isToggling}
        >
          {isToggling ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.statusBadgeText}>
              {isPaid ? '✓ Paid' : '✗ Unpaid'}
            </Text>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <StudentListShimmer />;
  }

  return (
    <View style={styles.container}>
      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{students.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statItem, styles.statDivider]}>
          <Text style={[styles.statNumber, { color: '#27ae60' }]}>{paidCount}</Text>
          <Text style={styles.statLabel}>Paid</Text>
        </View>
        <View style={[styles.statItem, styles.statDivider]}>
          <Text style={[styles.statNumber, { color: '#e74c3c' }]}>{unpaidCount}</Text>
          <Text style={styles.statLabel}>Unpaid</Text>
        </View>
      </View>

      {/* Search & Filter */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={COLORS.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, email, batch..."
          placeholderTextColor={COLORS.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.textTertiary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter Chips — Payment */}
      <View style={styles.filterRow}>
        {(['all', 'paid', 'unpaid'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f === 'all' ? 'All' : f === 'paid' ? `✓ Paid (${paidCount})` : `✗ Unpaid (${unpaidCount})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Filter Chips — Status */}
      <View style={styles.filterRow}>
        {(['all', 'active', 'inactive'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, statusFilter === f && (f === 'inactive' ? styles.filterChipInactive : styles.filterChipActive)]}
            onPress={() => setStatusFilter(f)}
          >
            <Text style={[styles.filterChipText, statusFilter === f && styles.filterChipTextActive]}>
              {f === 'all' ? 'All Status' : f === 'active' ? `Active (${activeCount})` : `Inactive (${inactiveCount})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Student List */}
      <FlatList
        data={filteredStudents}
        renderItem={renderStudent}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchStudents(); }} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={COLORS.textTertiary} />
            <Text style={styles.emptyText}>No students found</Text>
          </View>
        }
      />

      {/* Analytics Modal */}
      <Modal
        visible={!!analyticsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setAnalyticsModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Student Analytics</Text>
              <TouchableOpacity onPress={() => setAnalyticsModal(null)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {analyticsLoading ? (
              <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
            ) : analyticsModal ? (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Student Info */}
                <View style={styles.analyticSection}>
                  <Text style={styles.analyticSectionTitle}>Student Info</Text>
                  <View style={styles.analyticRow}>
                    <Text style={styles.analyticLabel}>Name</Text>
                    <Text style={styles.analyticValue}>{analyticsModal.student?.name || '-'}</Text>
                  </View>
                  <View style={styles.analyticRow}>
                    <Text style={styles.analyticLabel}>Email</Text>
                    <Text style={styles.analyticValue}>{analyticsModal.student?.email || '-'}</Text>
                  </View>
                  <View style={styles.analyticRow}>
                    <Text style={styles.analyticLabel}>Payment</Text>
                    <View style={[
                      styles.inlineBadge,
                      analyticsModal.student?.paymentStatus === 'paid' ? styles.badgePaid : styles.badgeUnpaid
                    ]}>
                      <Text style={styles.statusBadgeText}>
                        {analyticsModal.student?.paymentStatus === 'paid' ? '✓ Paid' : '✗ Unpaid'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Batches */}
                <View style={styles.analyticSection}>
                  <Text style={styles.analyticSectionTitle}>
                    Batches ({analyticsModal.batches?.length || 0})
                  </Text>
                  {(analyticsModal.batches || []).map((b: any, i: number) => (
                    <View key={i} style={styles.analyticRow}>
                      <Ionicons name="people-outline" size={14} color={COLORS.primary} />
                      <Text style={[styles.analyticValue, { marginLeft: 8 }]}>{b.name}</Text>
                    </View>
                  ))}
                  {(!analyticsModal.batches || analyticsModal.batches.length === 0) && (
                    <Text style={styles.emptyAnalytic}>No batches assigned</Text>
                  )}
                </View>

                {/* Enrollments */}
                <View style={styles.analyticSection}>
                  <Text style={styles.analyticSectionTitle}>
                    Enrollments ({analyticsModal.enrollments?.length || 0})
                  </Text>
                  {(analyticsModal.enrollments || []).map((e: any, i: number) => (
                    <View key={i} style={styles.enrollmentCard}>
                      <Text style={styles.enrollmentCourse}>{e.courseTitle}</Text>
                      <View style={styles.enrollmentRow}>
                        <Text style={[
                          styles.enrollmentStatus,
                          { color: e.status === 'Paid' ? '#27ae60' : '#e67e22' }
                        ]}>
                          {e.status}
                        </Text>
                        <Text style={styles.enrollmentAmount}>₹{e.amount}</Text>
                      </View>
                    </View>
                  ))}
                  {(!analyticsModal.enrollments || analyticsModal.enrollments.length === 0) && (
                    <Text style={styles.emptyAnalytic}>No enrollments</Text>
                  )}
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: SPACING.md, color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  statsBar: {
    flexDirection: 'row', backgroundColor: COLORS.surface, paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl, borderBottomWidth: 0.5, borderBottomColor: COLORS.border,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { borderLeftWidth: 1, borderLeftColor: COLORS.borderLight },
  statNumber: { fontSize: FONT_SIZE.xxl, fontWeight: '700', color: COLORS.text },
  statLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md, marginTop: SPACING.md, paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg, height: 44,
  },
  searchInput: { flex: 1, marginLeft: SPACING.sm, fontSize: FONT_SIZE.md, color: COLORS.text },
  filterRow: { flexDirection: 'row', paddingHorizontal: SPACING.md, marginTop: SPACING.sm, marginBottom: SPACING.xs },
  filterChip: {
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface, marginRight: SPACING.sm,
  },
  filterChipActive: { backgroundColor: COLORS.primary },
  filterChipInactive: { backgroundColor: '#e67e22' },
  filterChipText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: '500' },
  filterChipTextActive: { color: COLORS.textInverse },
  listContainer: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxxl },
  studentCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, padding: SPACING.md, marginTop: SPACING.sm, ...SHADOWS.sm,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md },
  avatarPaid: { backgroundColor: '#27ae6020' },
  avatarUnpaid: { backgroundColor: '#e74c3c20' },
  avatarText: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.text },
  studentInfo: { flex: 1, marginRight: SPACING.sm },
  studentName: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  studentEmail: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 1 },
  batchText: { fontSize: FONT_SIZE.xs, color: COLORS.primary, marginTop: 2, fontWeight: '500' },
  statusBadge: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: RADIUS.full, minWidth: 75, alignItems: 'center',
  },
  badgePaid: { backgroundColor: '#27ae60' },
  badgeUnpaid: { backgroundColor: '#e74c3c' },
  statusBadgeText: { color: '#fff', fontSize: FONT_SIZE.xs, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: FONT_SIZE.md, color: COLORS.textTertiary, marginTop: SPACING.md },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text },
  modalBody: { padding: SPACING.lg },
  analyticSection: { marginBottom: SPACING.xl },
  analyticSectionTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md, textTransform: 'uppercase', letterSpacing: 0.5 },
  analyticRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  analyticLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, width: 80 },
  analyticValue: { fontSize: FONT_SIZE.sm, color: COLORS.text, fontWeight: '500', flex: 1 },
  inlineBadge: { paddingHorizontal: SPACING.md, paddingVertical: 2, borderRadius: RADIUS.full },
  emptyAnalytic: { fontSize: FONT_SIZE.sm, color: COLORS.textTertiary, fontStyle: 'italic' },
  enrollmentCard: { backgroundColor: COLORS.background, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm },
  enrollmentCourse: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text },
  enrollmentRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.xs },
  enrollmentStatus: { fontSize: FONT_SIZE.xs, fontWeight: '600' },
  enrollmentAmount: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
});
