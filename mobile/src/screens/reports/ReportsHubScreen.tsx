/**
 * Reports Hub Screen — Teachers submit reports, Admin views all reports with analytics.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ScrollView, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS } from '../../theme/theme';
import { Logger } from '../../utils/logger';
import { apiClient } from '../../services/apiClient';
import Toast from 'react-native-toast-message';
import { ReportsListShimmer } from '../../components/ShimmerPlaceholder';
import { getDocs, collection, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

const TAG = 'ReportsHub';

interface Report {
  id: string;
  teacherName: string;
  batchName: string;
  reportType: 'daily' | 'weekly';
  classType?: 'batch' | 'private';
  className?: string;
  startTime?: string;
  endTime?: string;
  studentsPresent?: string[];
  studentsAbsent?: string[];
  topicsCovered?: string;
  comments?: string;
  reportText?: string;
  reportDate: string | null;
  createdAt: string | null;
}

export default function ReportsHubScreen({ navigation }: any) {
  const { userRole } = useAuth();
  const isAdmin = userRole?.toLowerCase() === 'admin';
  const isTeacher = userRole?.toLowerCase() === 'teacher';

  const [reports, setReports] = useState<Report[]>([]);
  const [studentsMap, setStudentsMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'daily' | 'weekly' | 'private'>('all');
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const snap = await getDocs(collection(db, 'Students'));
        const map: Record<string, string> = {};
        snap.docs.forEach(d => {
          map[d.id] = d.data().name || d.data().Name || 'Unknown';
          if (d.data().uid) map[d.data().uid] = map[d.id];
          if (d.data().Gmail) map[d.data().Gmail.toLowerCase()] = map[d.id];
        });
        setStudentsMap(map);
      } catch (err) {
        Logger.error(TAG, 'Error fetching students map', err);
      }
    };
    fetchStudents();
  }, []);

  const fetchReports = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/reports/list');
      setReports(response.reports || []);
    } catch (error: any) {
      Logger.error(TAG, 'Error fetching reports', error);
      Toast.show({ type: 'error', text1: 'Failed to load reports' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refetch every time screen gains focus (e.g. after submitting a new report)
  useFocusEffect(
    useCallback(() => {
      fetchReports();
    }, [fetchReports])
  );

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const filteredReports = (() => {
    let result = filter === 'all'
      ? reports
      : filter === 'private'
        ? reports.filter(r => r.classType === 'private')
        : reports.filter(r => r.reportType === filter);

    // Apply search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        (r.teacherName || '').toLowerCase().includes(q) ||
        (r.batchName || '').toLowerCase().includes(q) ||
        (r.className || '').toLowerCase().includes(q) ||
        (r.reportDate || '').toLowerCase().includes(q) ||
        (r.createdAt ? formatDate(r.createdAt).toLowerCase().includes(q) : false)
      );
    }
    return result;
  })();

  const dailyCount = reports.filter(r => r.reportType === 'daily').length;
  const weeklyCount = reports.filter(r => r.reportType === 'weekly').length;
  const privateCount = reports.filter(r => r.classType === 'private').length;

  const mapStudentNames = (ids?: string[]) => {
    if (!ids || ids.length === 0) return 'None';
    return ids.map(id => studentsMap[id] || id).join(', ');
  };

  const renderReport = ({ item }: { item: Report }) => {
    const isExpanded = expandedReport === item.id;
    const isDaily = item.reportType === 'daily';
    const isPrivate = item.classType === 'private';

    return (
      <TouchableOpacity
        style={styles.reportCard}
        onPress={() => setExpandedReport(isExpanded ? null : item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.reportHeader}>
          <View style={[styles.typeBadge, isPrivate ? styles.badgePrivate : isDaily ? styles.badgeDaily : styles.badgeWeekly]}>
            <Ionicons
              name={isPrivate ? 'person-outline' : isDaily ? 'today-outline' : 'calendar-outline'}
              size={12}
              color="#fff"
            />
            <Text style={styles.typeBadgeText}>{isPrivate ? 'Private' : isDaily ? 'Daily' : 'Weekly'}</Text>
          </View>
          <View style={styles.reportMeta}>
            <Text style={styles.reportTeacher}>{item.teacherName}</Text>
            <Text style={styles.reportBatch}>{item.batchName || 'Unknown Class'}</Text>
          </View>
          <Text style={styles.reportDate}>{formatDate(item.createdAt)}</Text>
        </View>

        {isDaily && (
          <View style={styles.reportSummary}>
            <Text style={styles.reportClassName}>{item.className}</Text>
            {item.startTime && item.endTime && (
              <Text style={styles.reportTime}>
                {item.startTime} → {item.endTime}
              </Text>
            )}
          </View>
        )}

        {item.reportText && (
          <Text style={styles.reportPreview} numberOfLines={isExpanded ? undefined : 2}>
            {item.reportText}
          </Text>
        )}

        {/* Expanded details for daily */}
        {isExpanded && isDaily && (
          <View style={styles.expandedDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="checkmark-circle" size={14} color="#27ae60" />
              <Text style={styles.detailLabel}>Present:</Text>
              <Text style={styles.detailValue}>
                {item.studentsPresent?.length || 0} students ({mapStudentNames(item.studentsPresent)})
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="close-circle" size={14} color="#e74c3c" />
              <Text style={styles.detailLabel}>Absent:</Text>
              <Text style={styles.detailValue}>
                {item.studentsAbsent?.length || 0} students ({mapStudentNames(item.studentsAbsent)})
              </Text>
            </View>
            {item.topicsCovered ? (
              <View style={styles.detailRow}>
                <Ionicons name="book-outline" size={14} color={COLORS.primary} />
                <Text style={styles.detailLabel}>Topics:</Text>
                <Text style={[styles.detailValue, { flex: 1 }]}>{item.topicsCovered}</Text>
              </View>
            ) : null}
            {item.comments ? (
              <View style={styles.detailRow}>
                <Ionicons name="chatbubble-outline" size={14} color={COLORS.textSecondary} />
                <Text style={styles.detailLabel}>Notes:</Text>
                <Text style={[styles.detailValue, { flex: 1 }]}>{item.comments}</Text>
              </View>
            ) : null}
          </View>
        )}

        <View style={styles.expandHint}>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={COLORS.textTertiary}
          />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <ReportsListShimmer />;
  }

  return (
    <View style={styles.container}>
      {/* Teacher: Submit buttons */}
      {isTeacher && (
        <View style={styles.submitSection}>
          <TouchableOpacity
            style={[styles.submitButton, styles.submitDaily]}
            onPress={() => navigation.navigate('DailyReport')}
          >
            <Ionicons name="today-outline" size={20} color="#fff" />
            <Text style={styles.submitButtonText}>Daily Report</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitButton, styles.submitWeekly]}
            onPress={() => navigation.navigate('WeeklyReport')}
          >
            <Ionicons name="calendar-outline" size={20} color="#fff" />
            <Text style={styles.submitButtonText}>Weekly Report</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Admin: Stats */}
      {isAdmin && (
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{reports.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={[styles.statItem, styles.statDivider]}>
            <Text style={[styles.statNumber, { color: '#3498db' }]}>{dailyCount}</Text>
            <Text style={styles.statLabel}>Daily</Text>
          </View>
          <View style={[styles.statItem, styles.statDivider]}>
            <Text style={[styles.statNumber, { color: '#9b59b6' }]}>{weeklyCount}</Text>
            <Text style={styles.statLabel}>Weekly</Text>
          </View>
          <View style={[styles.statItem, styles.statDivider]}>
            <Text style={[styles.statNumber, { color: '#e67e22' }]}>{privateCount}</Text>
            <Text style={styles.statLabel}>Private</Text>
          </View>
        </View>
      )}

      {/* Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        {(['all', 'daily', 'weekly', 'private'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={COLORS.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by date, class, teacher..."
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

      {/* Reports List */}
      <FlatList
        data={filteredReports}
        renderItem={renderReport}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchReports(); }} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color={COLORS.textTertiary} />
            <Text style={styles.emptyText}>No reports yet</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: SPACING.md, color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  submitSection: { flexDirection: 'row', paddingHorizontal: SPACING.md, paddingTop: SPACING.lg, gap: SPACING.sm },
  submitButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: SPACING.lg, borderRadius: RADIUS.lg, gap: SPACING.sm,
  },
  submitDaily: { backgroundColor: '#3498db' },
  submitWeekly: { backgroundColor: '#9b59b6' },
  submitButtonText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '600' },
  statsBar: {
    flexDirection: 'row', backgroundColor: COLORS.surface, paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl, borderBottomWidth: 0.5, borderBottomColor: COLORS.border,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { borderLeftWidth: 1, borderLeftColor: COLORS.borderLight },
  statNumber: { fontSize: FONT_SIZE.xxl, fontWeight: '700', color: COLORS.text },
  statLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  filterScroll: { flexGrow: 0, marginTop: SPACING.md, marginBottom: SPACING.xs, minHeight: 45 },
  filterRow: { flexDirection: 'row', paddingHorizontal: SPACING.md, paddingVertical: 4, alignItems: 'center' },
  filterChip: {
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface, marginRight: SPACING.sm,
  },
  filterChipActive: { backgroundColor: COLORS.primary },
  filterChipText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: '500' },
  filterChipTextActive: { color: COLORS.textInverse },
  listContainer: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxxl },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md, marginBottom: SPACING.sm, paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg, height: 44,
  },
  searchInput: { flex: 1, marginLeft: SPACING.sm, fontSize: FONT_SIZE.md, color: COLORS.text },
  reportCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md,
    marginTop: SPACING.sm, ...SHADOWS.sm,
  },
  reportHeader: { flexDirection: 'row', alignItems: 'center' },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm,
    paddingVertical: 3, borderRadius: RADIUS.full, gap: 4,
  },
  badgePrivate: { backgroundColor: '#e67e22' },
  badgeDaily: { backgroundColor: '#3498db' },
  badgeWeekly: { backgroundColor: '#9b59b6' },
  typeBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  reportMeta: { flex: 1, marginLeft: SPACING.sm },
  reportTeacher: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text },
  reportBatch: { fontSize: FONT_SIZE.xs, color: COLORS.primary, fontWeight: '500' },
  reportDate: { fontSize: FONT_SIZE.xs, color: COLORS.textTertiary },
  reportSummary: { marginTop: SPACING.sm },
  reportClassName: { fontSize: FONT_SIZE.md, fontWeight: '500', color: COLORS.text },
  reportTime: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  reportPreview: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.sm, lineHeight: 20 },
  expandedDetails: { marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 0.5, borderTopColor: COLORS.borderLight },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.sm, gap: SPACING.sm },
  detailLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textSecondary, width: 55 },
  detailValue: { fontSize: FONT_SIZE.sm, color: COLORS.text },
  expandHint: { alignItems: 'center', marginTop: SPACING.xs },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: FONT_SIZE.md, color: COLORS.textTertiary, marginTop: SPACING.md },
});
