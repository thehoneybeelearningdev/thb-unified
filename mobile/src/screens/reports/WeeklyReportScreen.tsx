/**
 * Weekly Report Screen — Teachers submit weekly class reports.
 * Step 1: Choose class type (Batch / Private)
 * Step 2: Select batch or student from a bottom sheet
 * Step 3: Write summary and submit
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

const TAG = 'WeeklyReport';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ClassOption {
  id: string;
  name: string;
  classType: 'batch' | 'private';
  studentCount?: number;
}

type ClassType = 'batch' | 'private' | null;

export default function WeeklyReportScreen({ navigation }: any) {
  const { currentUser, userRole } = useAuth();
  const [batchClasses, setBatchClasses] = useState<ClassOption[]>([]);
  const [privateClasses, setPrivateClasses] = useState<ClassOption[]>([]);
  const [selectedClassType, setSelectedClassType] = useState<ClassType>(null);
  const [selectedClass, setSelectedClass] = useState<ClassOption | null>(null);
  const [reportText, setReportText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const batches: ClassOption[] = [];
        const privates: ClassOption[] = [];
        const isTeacher = userRole?.toLowerCase() === 'teacher';
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

          batches.push({
            id: bDoc.id,
            name: data.name || data.batchName || bDoc.id,
            classType: 'batch',
            studentCount: (data.students || []).length,
          });
        }

        // 2. Fetch Private Chats
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
    setSelectedClass(null);
    setTimeout(() => openBottomSheet(), 100);
  };

  const handleSelectItem = (item: ClassOption) => {
    setSelectedClass(item);
    closeBottomSheet();
  };

  const handleSubmit = async () => {
    if (!selectedClass || !reportText.trim()) {
      Toast.show({ type: 'error', text1: 'Missing info', text2: 'Please select a class and write your report.' });
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/api/reports/weekly', {
        batchId: selectedClass.id,
        batchName: selectedClass.name,
        classType: selectedClass.classType,
        reportText: reportText.trim(),
      });

      Toast.show({ type: 'success', text1: 'Report submitted!', text2: 'Weekly report saved successfully.' });
      navigation.goBack();
    } catch (error: any) {
      Logger.error(TAG, 'Error submitting weekly report', error);
      Toast.show({ type: 'error', text1: 'Submission failed', text2: error?.message || 'Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const currentList = selectedClassType === 'batch' ? batchClasses : privateClasses;
  const filteredList = currentList.filter(b =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loadingClasses) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#9b59b6" />
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
          <View style={styles.headerSection}>
            <Ionicons name="calendar-outline" size={28} color="#9b59b6" />
            <Text style={styles.headerTitle}>Weekly Report</Text>
            <Text style={styles.headerSubtitle}>
              Summarize this week's progress for the selected class
            </Text>
          </View>

          {/* Step 1: Class Type */}
          <Text style={styles.sectionTitle}>Class Type *</Text>
          <View style={styles.classTypeRow}>
            <TouchableOpacity
              style={[
                styles.classTypeCard,
                selectedClassType === 'batch' && styles.classTypeCardActiveBatch,
              ]}
              onPress={() => handleClassTypeSelect('batch')}
            >
              <View style={[styles.classTypeIcon, selectedClassType === 'batch' && { backgroundColor: '#9b59b6' }]}>
                <Ionicons name="people" size={24} color={selectedClassType === 'batch' ? '#fff' : '#9b59b6'} />
              </View>
              <Text style={[styles.classTypeLabel, selectedClassType === 'batch' && { color: '#9b59b6' }]}>
                Batch Class
              </Text>
              <Text style={styles.classTypeCount}>{batchClasses.length} batches</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.classTypeCard,
                selectedClassType === 'private' && styles.classTypeCardActivePrivate,
              ]}
              onPress={() => handleClassTypeSelect('private')}
            >
              <View style={[styles.classTypeIcon, selectedClassType === 'private' && { backgroundColor: '#e67e22' }]}>
                <Ionicons name="person" size={24} color={selectedClassType === 'private' ? '#fff' : '#e67e22'} />
              </View>
              <Text style={[styles.classTypeLabel, selectedClassType === 'private' && { color: '#e67e22' }]}>
                Private (1-on-1)
              </Text>
              <Text style={styles.classTypeCount}>{privateClasses.length} students</Text>
            </TouchableOpacity>
          </View>

          {/* Step 2: Selected Class */}
          {selectedClass && (
            <TouchableOpacity style={styles.selectedCard} onPress={openBottomSheet} activeOpacity={0.7}>
              <View style={styles.selectedCardLeft}>
                <View style={[
                  styles.selectedBadge,
                  { backgroundColor: selectedClassType === 'batch' ? '#9b59b615' : '#e67e2215' },
                ]}>
                  <Ionicons
                    name={selectedClassType === 'batch' ? 'people' : 'person'}
                    size={18}
                    color={selectedClassType === 'batch' ? '#9b59b6' : '#e67e22'}
                  />
                </View>
                <View>
                  <Text style={styles.selectedName}>{selectedClass.name}</Text>
                  <Text style={styles.selectedMeta}>
                    {selectedClassType === 'batch'
                      ? `${selectedClass.studentCount || 0} students`
                      : 'Private class'}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-down" size={18} color={COLORS.textTertiary} />
            </TouchableOpacity>
          )}

          {!selectedClass && selectedClassType && (
            <TouchableOpacity style={styles.selectPrompt} onPress={openBottomSheet}>
              <Ionicons name="add-circle-outline" size={20} color="#9b59b6" />
              <Text style={[styles.selectPromptText, { color: '#9b59b6' }]}>
                Tap to select {selectedClassType === 'batch' ? 'a batch' : 'a student'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Step 3: Report */}
          {selectedClass && (
            <>
              <Text style={styles.sectionTitle}>Weekly Summary *</Text>
              <TextInput
                style={styles.textArea}
                value={reportText}
                onChangeText={setReportText}
                placeholder={"Write your weekly summary here...\n\n• What was accomplished\n• Student progress\n• Areas of concern\n• Plans for next week"}
                placeholderTextColor={COLORS.textTertiary}
                multiline
                numberOfLines={10}
                textAlignVertical="top"
                maxLength={5000}
              />
              <Text style={styles.charCount}>{reportText.length}/5000</Text>

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
                    <Text style={styles.submitButtonText}>Submit Weekly Report</Text>
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

          <FlatList
            data={filteredList}
            keyExtractor={item => item.id}
            style={styles.sheetList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.sheetItem,
                  selectedClass?.id === item.id && styles.sheetItemActive,
                ]}
                onPress={() => handleSelectItem(item)}
              >
                <View style={[
                  styles.sheetItemIcon,
                  { backgroundColor: selectedClassType === 'batch' ? '#9b59b615' : '#e67e2215' },
                ]}>
                  <Ionicons
                    name={selectedClassType === 'batch' ? 'people-outline' : 'person-outline'}
                    size={18}
                    color={selectedClassType === 'batch' ? '#9b59b6' : '#e67e22'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetItemName}>{item.name}</Text>
                  <Text style={styles.sheetItemMeta}>
                    {selectedClassType === 'batch'
                      ? `${item.studentCount || 0} students`
                      : 'Private class'}
                  </Text>
                </View>
                {selectedClass?.id === item.id && (
                  <Ionicons name="checkmark-circle" size={20} color="#9b59b6" />
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
  headerSection: { alignItems: 'center', paddingVertical: SPACING.xl },
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '700', color: COLORS.text, marginTop: SPACING.sm },
  headerSubtitle: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.xs, textAlign: 'center' },
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
  classTypeCardActiveBatch: { borderColor: '#9b59b6', backgroundColor: '#9b59b610' },
  classTypeCardActivePrivate: { borderColor: '#e67e22', backgroundColor: '#e67e2210' },
  classTypeIcon: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#9b59b615',
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm,
  },
  classTypeLabel: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
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
    backgroundColor: '#9b59b610', borderRadius: RADIUS.lg, padding: SPACING.lg,
    marginTop: SPACING.lg, borderWidth: 1, borderColor: '#9b59b6', borderStyle: 'dashed',
  },
  selectPromptText: { fontSize: FONT_SIZE.md, fontWeight: '500' },

  // Report
  textArea: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md, fontSize: FONT_SIZE.md, color: COLORS.text,
    minHeight: 200, borderWidth: 1, borderColor: COLORS.borderLight, textAlignVertical: 'top',
  },
  charCount: { fontSize: FONT_SIZE.xs, color: COLORS.textTertiary, textAlign: 'right', marginTop: 4 },
  submitButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: '#9b59b6', paddingVertical: SPACING.lg, borderRadius: RADIUS.lg, marginTop: SPACING.xxl,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontSize: FONT_SIZE.lg, fontWeight: '600' },

  // Bottom Sheet
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  bottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.6, paddingBottom: SPACING.xxl, ...SHADOWS.lg,
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
  sheetItemActive: { backgroundColor: '#9b59b610', borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm },
  sheetItemIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md,
  },
  sheetItemName: { fontSize: FONT_SIZE.md, fontWeight: '500', color: COLORS.text },
  sheetItemMeta: { fontSize: FONT_SIZE.xs, color: COLORS.textTertiary, marginTop: 1 },
  emptySheet: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xxxl },
  emptySheetText: { fontSize: FONT_SIZE.sm, color: COLORS.textTertiary, marginTop: SPACING.sm },
});
