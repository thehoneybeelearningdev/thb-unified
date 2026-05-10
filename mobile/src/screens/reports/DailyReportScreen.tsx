/**
 * Daily Report Screen — Teachers submit daily class reports.
 * Step 1: Choose class type (Batch / Private)
 * Step 2: Select batch or student from a bottom sheet
 * Step 3: Fill report fields and submit
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Platform, Modal, FlatList,
  Animated, Dimensions, Pressable, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS } from '../../theme/theme';
import { Logger } from '../../utils/logger';
import { apiClient } from '../../services/apiClient';
import Toast from 'react-native-toast-message';
import { db } from '../../config/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

const TAG = 'DailyReport';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BatchOption {
  id: string;
  name: string;
  classType: 'batch' | 'private';
  students: { id: string; name: string }[];
}

type ClassType = 'batch' | 'private' | null;

export default function DailyReportScreen({ navigation }: any) {
  const { currentUser, userName, userRole } = useAuth();
  const [batchClasses, setBatchClasses] = useState<BatchOption[]>([]);
  const [privateClasses, setPrivateClasses] = useState<BatchOption[]>([]);
  const [selectedClassType, setSelectedClassType] = useState<ClassType>(null);
  const [selectedBatch, setSelectedBatch] = useState<BatchOption | null>(null);
  const [className, setClassName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [presentIds, setPresentIds] = useState<string[]>([]);
  const [topicsCovered, setTopicsCovered] = useState('');
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Fetch batches and private classes
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const batches: BatchOption[] = [];
        const privates: BatchOption[] = [];
        const isTeacher = userRole?.toLowerCase() === 'teacher';
        const isAdmin = userRole?.toLowerCase() === 'admin';
        const myUid = currentUser?.uid;
        const myEmail = currentUser?.email?.toLowerCase();

        // Find teacher's doc ID for filtering
        let myTeacherDocId: string | null = null;
        if (isTeacher) {
          const teachersSnap = await getDocs(collection(db, 'Teacher'));
          for (const tDoc of teachersSnap.docs) {
            const td = tDoc.data();
            const tEmail = (td.Gmail || td.email || '').toLowerCase();
            if (td.uid === myUid || tDoc.id === myUid || (myEmail && tEmail === myEmail)) {
              myTeacherDocId = tDoc.id;
              break;
            }
          }
        }

        // 1. Fetch Batches
        const batchesSnap = await getDocs(collection(db, 'batches'));
        for (const bDoc of batchesSnap.docs) {
          const data = bDoc.data();

          // Teacher filter: only show batches assigned to this teacher
          if (isTeacher && myTeacherDocId) {
            if (data.teacherId !== myTeacherDocId && data.teacherId !== myUid) continue;
          }

          const studentIds: string[] = data.students || [];
          const students: { id: string; name: string }[] = [];

          for (const sid of studentIds.slice(0, 30)) {
            try {
              const sDoc = await getDoc(doc(db, 'Students', sid));
              if (sDoc.exists()) {
                students.push({ id: sid, name: sDoc.data()?.name || sDoc.data()?.Name || 'Student' });
              }
            } catch {}
          }

          batches.push({
            id: bDoc.id,
            name: data.name || data.batchName || bDoc.id,
            classType: 'batch',
            students,
          });
        }

        // 2. Fetch Private Chats (1-on-1 Classes)
        const chatsSnap = await getDocs(collection(db, 'chats'));
        for (const cDoc of chatsSnap.docs) {
          const data = cDoc.data();
          const users: string[] = data.users || [];

          // Teacher filter: only show private chats where teacher is a participant
          if (isTeacher) {
            const isParticipant = users.includes(myUid || '') ||
              data.teacherId === myTeacherDocId ||
              data.teacherId === myUid;
            if (!isParticipant) continue;
          }

          const studentId = data.studentId || users.find(u => u !== 'admin' && u !== currentUser?.uid);
          if (!studentId) continue;

          let studentName = 'Student';
          try {
            const sDoc = await getDoc(doc(db, 'Students', studentId));
            if (sDoc.exists()) studentName = sDoc.data()?.name || sDoc.data()?.Name || 'Student';
          } catch {}

          privates.push({
            id: cDoc.id,
            name: data.name || studentName,
            classType: 'private',
            students: [{ id: studentId, name: studentName }],
          });
        }

        setBatchClasses(batches);
        setPrivateClasses(privates);
      } catch (error) {
        Logger.error(TAG, 'Error fetching classes', error);
      } finally {
        setLoadingClasses(false);
      }
    };
    fetchClasses();
  }, [currentUser, userRole]);

  const openBottomSheet = () => {
    setSearchTerm('');
    setBottomSheetVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 65,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  const closeBottomSheet = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setBottomSheetVisible(false));
  };

  const handleClassTypeSelect = (type: ClassType) => {
    setSelectedClassType(type);
    setSelectedBatch(null);
    setClassName('');
    setPresentIds([]);
    // Open bottom sheet after selecting type
    setTimeout(() => openBottomSheet(), 100);
  };

  const handleSelectItem = (item: BatchOption) => {
    setSelectedBatch(item);
    setClassName(item.name);
    setPresentIds([]);
    closeBottomSheet();
  };

  const togglePresent = (studentId: string) => {
    setPresentIds(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const absentIds = selectedBatch
    ? selectedBatch.students.filter(s => !presentIds.includes(s.id)).map(s => s.id)
    : [];

  const handleSubmit = async () => {
    if (!selectedBatch || !className.trim() || !startTime.trim() || !endTime.trim()) {
      Toast.show({ type: 'error', text1: 'Missing info', text2: 'Please fill all required fields.' });
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/api/reports/daily', {
        batchId: selectedBatch.id,
        batchName: selectedBatch.name,
        classType: selectedBatch.classType,
        className: className.trim(),
        startTime: startTime.trim(),
        endTime: endTime.trim(),
        studentsPresent: presentIds,
        studentsAbsent: absentIds,
        topicsCovered: topicsCovered.trim(),
        comments: comments.trim(),
      });

      Toast.show({ type: 'success', text1: 'Report submitted!', text2: 'Daily report saved successfully.' });
      navigation.goBack();
    } catch (error: any) {
      Logger.error(TAG, 'Error submitting report', error);
      Toast.show({ type: 'error', text1: 'Submission failed', text2: error?.message || 'Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Filter list for bottom sheet
  const currentList = selectedClassType === 'batch' ? batchClasses : privateClasses;
  const filteredList = currentList.filter(b =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loadingClasses) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading classes...</Text>
      </View>
    );
  }

  return (
    <>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          {/* Step 1: Class Type Selector */}
          <Text style={styles.sectionTitle}>Class Type *</Text>
          <View style={styles.classTypeRow}>
            <TouchableOpacity
              style={[
                styles.classTypeCard,
                selectedClassType === 'batch' && styles.classTypeCardActive,
              ]}
              onPress={() => handleClassTypeSelect('batch')}
            >
              <View style={[styles.classTypeIcon, selectedClassType === 'batch' && styles.classTypeIconActive]}>
                <Ionicons name="people" size={24} color={selectedClassType === 'batch' ? '#fff' : COLORS.primary} />
              </View>
              <Text style={[styles.classTypeLabel, selectedClassType === 'batch' && styles.classTypeLabelActive]}>
                Batch Class
              </Text>
              <Text style={styles.classTypeCount}>{batchClasses.length} batches</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.classTypeCard,
                selectedClassType === 'private' && styles.classTypeCardActive,
              ]}
              onPress={() => handleClassTypeSelect('private')}
            >
              <View style={[styles.classTypeIcon, selectedClassType === 'private' && styles.classTypeIconActive]}>
                <Ionicons name="person" size={24} color={selectedClassType === 'private' ? '#fff' : '#9b59b6'} />
              </View>
              <Text style={[styles.classTypeLabel, selectedClassType === 'private' && styles.classTypeLabelActive]}>
                Private (1-on-1)
              </Text>
              <Text style={styles.classTypeCount}>{privateClasses.length} students</Text>
            </TouchableOpacity>
          </View>

          {/* Step 2: Selected Batch/Student */}
          {selectedBatch && (
            <TouchableOpacity style={styles.selectedCard} onPress={openBottomSheet} activeOpacity={0.7}>
              <View style={styles.selectedCardLeft}>
                <View style={[
                  styles.selectedBadge,
                  { backgroundColor: selectedClassType === 'batch' ? COLORS.primaryFaded : '#9b59b615' },
                ]}>
                  <Ionicons
                    name={selectedClassType === 'batch' ? 'people' : 'person'}
                    size={18}
                    color={selectedClassType === 'batch' ? COLORS.primary : '#9b59b6'}
                  />
                </View>
                <View>
                  <Text style={styles.selectedName}>{selectedBatch.name}</Text>
                  <Text style={styles.selectedMeta}>
                    {selectedClassType === 'batch'
                      ? `${selectedBatch.students.length} students`
                      : 'Private class'}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-down" size={18} color={COLORS.textTertiary} />
            </TouchableOpacity>
          )}

          {!selectedBatch && selectedClassType && (
            <TouchableOpacity style={styles.selectPrompt} onPress={openBottomSheet}>
              <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
              <Text style={styles.selectPromptText}>
                Tap to select {selectedClassType === 'batch' ? 'a batch' : 'a student'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Step 3: Report Fields */}
          {selectedBatch && (
            <>
              <Text style={styles.sectionTitle}>Class Name *</Text>
              <TextInput
                style={styles.input}
                value={className}
                onChangeText={setClassName}
                placeholder="e.g. Math Level 2"
                placeholderTextColor={COLORS.textTertiary}
              />

              <View style={styles.timeRow}>
                <View style={styles.timeCol}>
                  <Text style={styles.sectionTitle}>Start Time *</Text>
                  <TextInput
                    style={styles.input}
                    value={startTime}
                    onChangeText={setStartTime}
                    placeholder="e.g. 10:00 AM"
                    placeholderTextColor={COLORS.textTertiary}
                  />
                </View>
                <View style={styles.timeCol}>
                  <Text style={styles.sectionTitle}>End Time *</Text>
                  <TextInput
                    style={styles.input}
                    value={endTime}
                    onChangeText={setEndTime}
                    placeholder="e.g. 11:30 AM"
                    placeholderTextColor={COLORS.textTertiary}
                  />
                </View>
              </View>

              {selectedBatch.students.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>
                    Attendance ({presentIds.length}/{selectedBatch.students.length} present)
                  </Text>
                  <View style={styles.attendanceGrid}>
                    {selectedBatch.students.map(s => {
                      const isPresent = presentIds.includes(s.id);
                      return (
                        <TouchableOpacity
                          key={s.id}
                          style={[styles.studentChip, isPresent ? styles.chipPresent : styles.chipAbsent]}
                          onPress={() => togglePresent(s.id)}
                        >
                          <Ionicons
                            name={isPresent ? 'checkmark-circle' : 'close-circle'}
                            size={16}
                            color={isPresent ? '#27ae60' : '#e74c3c'}
                          />
                          <Text style={[styles.studentChipText, isPresent ? styles.textPresent : styles.textAbsent]}>
                            {s.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              <Text style={styles.sectionTitle}>Topics Covered</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={topicsCovered}
                onChangeText={setTopicsCovered}
                placeholder="What was covered in class..."
                placeholderTextColor={COLORS.textTertiary}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.sectionTitle}>Comments / Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={comments}
                onChangeText={setComments}
                placeholder="Any additional notes..."
                placeholderTextColor={COLORS.textTertiary}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.submitButtonText}>Submit Daily Report</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Sheet */}
      <Modal visible={bottomSheetVisible} transparent animationType="none" onRequestClose={closeBottomSheet}>
        <Pressable style={styles.overlay} onPress={closeBottomSheet} />
        <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>
            {selectedClassType === 'batch' ? 'Select Batch' : 'Select Student'}
          </Text>

          {/* Search */}
          <View style={styles.sheetSearchContainer}>
            <Ionicons name="search" size={16} color={COLORS.textTertiary} />
            <TextInput
              style={styles.sheetSearchInput}
              placeholder={selectedClassType === 'batch' ? 'Search batches...' : 'Search students...'}
              placeholderTextColor={COLORS.textTertiary}
              value={searchTerm}
              onChangeText={setSearchTerm}
              autoFocus
            />
          </View>

          {/* List */}
          <FlatList
            data={filteredList}
            keyExtractor={item => item.id}
            style={styles.sheetList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.sheetItem,
                  selectedBatch?.id === item.id && styles.sheetItemActive,
                ]}
                onPress={() => handleSelectItem(item)}
              >
                <View style={[
                  styles.sheetItemIcon,
                  { backgroundColor: selectedClassType === 'batch' ? COLORS.primaryFaded : '#9b59b615' },
                ]}>
                  <Ionicons
                    name={selectedClassType === 'batch' ? 'people-outline' : 'person-outline'}
                    size={18}
                    color={selectedClassType === 'batch' ? COLORS.primary : '#9b59b6'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetItemName}>{item.name}</Text>
                  <Text style={styles.sheetItemMeta}>
                    {selectedClassType === 'batch'
                      ? `${item.students.length} students`
                      : 'Private class'}
                  </Text>
                </View>
                {selectedBatch?.id === item.id && (
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptySheet}>
                <Ionicons name="search-outline" size={36} color={COLORS.textTertiary} />
                <Text style={styles.emptySheetText}>No results found</Text>
              </View>
            }
          />
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxxl },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: SPACING.md, color: COLORS.textSecondary },
  sectionTitle: {
    fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text,
    marginTop: SPACING.lg, marginBottom: SPACING.sm,
  },

  // Class Type Selector
  classTypeRow: { flexDirection: 'row', gap: SPACING.md },
  classTypeCard: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.lg, alignItems: 'center', borderWidth: 2,
    borderColor: COLORS.borderLight, ...SHADOWS.sm,
  },
  classTypeCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryFaded },
  classTypeIcon: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primaryFaded,
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm,
  },
  classTypeIconActive: { backgroundColor: COLORS.primary },
  classTypeLabel: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  classTypeLabelActive: { color: COLORS.primary },
  classTypeCount: { fontSize: FONT_SIZE.xs, color: COLORS.textTertiary, marginTop: 2 },

  // Selected Card
  selectedCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.lg,
    marginTop: SPACING.lg, ...SHADOWS.sm, borderWidth: 1, borderColor: COLORS.borderLight,
  },
  selectedCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  selectedBadge: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md,
  },
  selectedName: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  selectedMeta: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 1 },

  // Select Prompt
  selectPrompt: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.primaryFaded, borderRadius: RADIUS.lg, padding: SPACING.lg,
    marginTop: SPACING.lg, borderWidth: 1, borderColor: COLORS.primary, borderStyle: 'dashed',
  },
  selectPromptText: { fontSize: FONT_SIZE.md, color: COLORS.primary, fontWeight: '500' },

  // Form Fields
  input: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.lg,
    paddingVertical: Platform.OS === 'ios' ? SPACING.md : SPACING.sm,
    fontSize: FONT_SIZE.md, color: COLORS.text, borderWidth: 1, borderColor: COLORS.borderLight,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  timeRow: { flexDirection: 'row', gap: SPACING.md },
  timeCol: { flex: 1 },
  attendanceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  studentChip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm, borderRadius: RADIUS.full, gap: 4,
  },
  chipPresent: { backgroundColor: '#27ae6015', borderWidth: 1, borderColor: '#27ae6040' },
  chipAbsent: { backgroundColor: '#e74c3c15', borderWidth: 1, borderColor: '#e74c3c40' },
  studentChipText: { fontSize: FONT_SIZE.sm, fontWeight: '500' },
  textPresent: { color: '#27ae60' },
  textAbsent: { color: '#e74c3c' },
  submitButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: '#3498db', paddingVertical: SPACING.lg, borderRadius: RADIUS.lg, marginTop: SPACING.xxl,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontSize: FONT_SIZE.lg, fontWeight: '600' },

  // Bottom Sheet
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  bottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.6, paddingBottom: SPACING.xxl,
    ...SHADOWS.lg,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border,
    alignSelf: 'center', marginTop: SPACING.md,
  },
  sheetTitle: {
    fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text,
    textAlign: 'center', marginVertical: SPACING.md,
  },
  sheetSearchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background,
    marginHorizontal: SPACING.lg, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  sheetSearchInput: {
    flex: 1, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm,
    fontSize: FONT_SIZE.md, color: COLORS.text,
  },
  sheetList: { paddingHorizontal: SPACING.lg },
  sheetItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.borderLight,
  },
  sheetItemActive: { backgroundColor: COLORS.primaryFaded, borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm },
  sheetItemIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md,
  },
  sheetItemName: { fontSize: FONT_SIZE.md, fontWeight: '500', color: COLORS.text },
  sheetItemMeta: { fontSize: FONT_SIZE.xs, color: COLORS.textTertiary, marginTop: 1 },
  emptySheet: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xxxl,
  },
  emptySheetText: { fontSize: FONT_SIZE.sm, color: COLORS.textTertiary, marginTop: SPACING.sm },
});
