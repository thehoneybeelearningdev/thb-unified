/**
 * Batch List Screen — Shows user's assigned batches.
 * Port of web's Sidebar batch listing logic.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../config/firebase';
import {
  collection, query, where, onSnapshot, getDocs, doc, getDoc,
  Unsubscribe
} from 'firebase/firestore';
import { subscribeToUnreadCount, markBatchAsRead } from '../../utils/chatUtils';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS } from '../../theme/theme';
import { Logger } from '../../utils/logger';
import { BatchListShimmer } from '../../components/ShimmerPlaceholder';

const TAG = 'BatchList';

export default function BatchListScreen({ navigation }: any) {
  const { currentUser, userRole } = useAuth();
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [myStudentDocId, setMyStudentDocId] = useState<string | null>(null);
  const [batchUnreadCounts, setBatchUnreadCounts] = useState<Record<string, number>>({});
  const [students, setStudents] = useState<any[]>([]);

  // Fetch teachers
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'Teacher')), (snapshot) => {
      setTeachers(snapshot.docs.map(d => ({
        id: d.id,
        uid: d.data().uid || d.id,
        name: d.data().name || 'Unknown',
        email: d.data().Gmail || d.data().email || '',
        ...d.data(),
      })));
    });
    return () => unsub();
  }, []);

  // Fetch students
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'Students')), (snapshot) => {
      setStudents(snapshot.docs.map(d => ({
        id: d.id,
        uid: d.data().uid || d.id,
        name: d.data().name || d.data().Name || 'Unknown',
        email: d.data().Gmail || d.data().email || '',
        ...d.data(),
      })));
    });
    return () => unsub();
  }, []);

  // Fetch courses
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'courses')), (snapshot) => {
      if (snapshot.empty) {
        setCourses([]);
      } else {
        setCourses(snapshot.docs.map(d => ({
          id: d.id,
          courseName: d.data().name || d.data().courseName || '',
          ...d.data(),
        })).filter((c: any) => c.status === 'active'));
      }
    });
    return () => unsub();
  }, []);

  // Resolve student doc ID for batch matching
  useEffect(() => {
    if (!currentUser || userRole?.toLowerCase() !== 'student') return;

    const resolve = async () => {
      const email = currentUser.email?.toLowerCase();
      if (email) {
        try {
          const snap = await getDoc(doc(db, 'Students', email));
          if (snap.exists()) { setMyStudentDocId(snap.id); return; }
        } catch {}
      }
      if (currentUser.uid) {
        try {
          const q = query(collection(db, 'Students'), where('uid', '==', currentUser.uid));
          const qs = await getDocs(q);
          if (!qs.empty) { setMyStudentDocId(qs.docs[0].id); return; }
        } catch {}
      }
      if (email) {
        try {
          const q = query(collection(db, 'Students'), where('Gmail', '==', email));
          const qs = await getDocs(q);
          if (!qs.empty) { setMyStudentDocId(qs.docs[0].id); return; }
        } catch {}
      }
    };
    resolve();
  }, [currentUser, userRole]);

  // Fetch batches with role-aware filtering
  useEffect(() => {
    const batchesQuery = query(collection(db, 'batches'), where('status', '==', 'active'));
    const unsub = onSnapshot(batchesQuery, (snapshot) => {
      const batchesData = snapshot.docs.map(d => {
        const data = d.data();
        const teacherInfo = teachers.find(t => t.id === data.teacherId);
        const courseInfo = courses.find(c => c.id === data.courseId);

        return {
          id: d.id,
          ...data,
          teacher: teacherInfo?.name || 'Teacher',
          courseName: courseInfo?.courseName || '',
          students: Array.isArray(data.students) ? data.students : [],
          studentsCount: Array.isArray(data.students) ? data.students.length : 0,
        };
      });

      const roleLower = (userRole || '').toLowerCase();
      const myUid = currentUser?.uid;
      const myEmail = currentUser?.email?.toLowerCase();

      const visible = batchesData.filter(batch => {
        if (roleLower === 'admin') return true;
        if (roleLower === 'teacher') {
          const myTeacher = teachers.find(t =>
            t.uid === myUid || t.id === myUid || (myEmail && t.email?.toLowerCase() === myEmail)
          );
          return (batch as any).teacherId === myTeacher?.id || (batch as any).teacherId === myTeacher?.uid;
        }
        if (roleLower === 'student') {
          const assigned = Array.isArray(batch.students) ? batch.students : [];
          const normalized = assigned.map((e: any) =>
            typeof e === 'string' ? e.toLowerCase() : (e?.email?.toLowerCase() || e?.Gmail?.toLowerCase() || e?.uid || '')
          ).filter(Boolean);
          return (
            (myEmail && normalized.includes(myEmail)) ||
            (myUid && normalized.includes(myUid)) ||
            (myStudentDocId && normalized.includes(myStudentDocId.toLowerCase())) ||
            (myStudentDocId && assigned.includes(myStudentDocId))
          );
        }
        return false;
      });

      setBatches(visible);
      if (visible.length > 0) {
        setLoading(false);
      } else {
        setTimeout(() => setLoading(false), 800);
      }
    });

    return () => unsub();
  }, [teachers, courses, currentUser, userRole, myStudentDocId]);

  // Unread counts for batches
  useEffect(() => {
    if (!currentUser?.uid || batches.length === 0) return;
    const unsubs: Unsubscribe[] = [];
    batches.forEach(batch => {
      const unsub = subscribeToUnreadCount(batch.id, currentUser.uid, false, (count) => {
        setBatchUnreadCounts(prev => ({ ...prev, [batch.id]: count }));
      });
      unsubs.push(unsub);
    });
    return () => unsubs.forEach(u => u());
  }, [currentUser?.uid, batches.length]);

  const handleBatchPress = (batch: any) => {
    if (currentUser?.uid) {
      markBatchAsRead(batch.id, currentUser.uid);
    }
    
    navigation.navigate('BatchChat', {
      batchId: batch.id,
      batchName: batch.batchName || 'Batch',
      teacher: batch.teacher,
      studentsCount: batch.studentsCount,
      courseName: batch.courseName,
    });
  };

  const renderBatch = ({ item }: { item: any }) => {
    const initial = (item.batchName || 'B').charAt(0).toUpperCase();
    const unread = batchUnreadCounts[item.id] || 0;

    // Map student IDs to names
    const studentNames = (item.students || []).map((sId: string) => {
      const student = students.find(s => s.id === sId || s.uid === sId || s.email?.toLowerCase() === sId?.toLowerCase());
      return student ? student.name.split(' ')[0] : 'Unknown';
    });
    
    const studentsDisplay = studentNames.length > 0 
      ? studentNames.join(', ') 
      : 'No students';

    return (
      <TouchableOpacity
        style={styles.batchItem}
        onPress={() => handleBatchPress(item)}
        activeOpacity={0.6}
      >
        <View style={styles.batchAvatar}>
          <Text style={styles.batchAvatarText}>{initial}</Text>
        </View>
        <View style={styles.batchInfo}>
          <View style={styles.batchTopRow}>
            <Text style={styles.batchName} numberOfLines={1}>{item.batchName || 'Batch'}</Text>
            {unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            )}
          </View>
          <Text style={styles.batchCourse} numberOfLines={1}>
            {item.courseName || 'Course'}
          </Text>
          <View style={styles.batchMeta}>
            <Ionicons name="person-outline" size={12} color={COLORS.textTertiary} />
            <Text style={styles.batchMetaText}>{item.teacher}</Text>
            <Text style={styles.batchDot}>•</Text>
            <Ionicons name="people-outline" size={12} color={COLORS.textTertiary} />
            <Text style={[styles.batchMetaText, { flex: 1 }]} numberOfLines={1}>
              {studentsDisplay}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <BatchListShimmer />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={batches}
        renderItem={renderBatch}
        keyExtractor={(item) => item.id}
        contentContainerStyle={batches.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color={COLORS.textTertiary} />
            <Text style={styles.emptyTitle}>No Batches</Text>
            <Text style={styles.emptySubtitle}>
              You haven't been assigned to any batches yet.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: SPACING.md, fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  batchItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.surface, borderBottomWidth: 0.5, borderBottomColor: COLORS.borderLight,
  },
  batchAvatar: {
    width: 50, height: 50, borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryFaded, alignItems: 'center', justifyContent: 'center',
    marginRight: SPACING.md,
  },
  batchAvatarText: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.primary },
  batchInfo: { flex: 1 },
  batchTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  batchName: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text, flex: 1, marginRight: SPACING.sm },
  batchCourse: { fontSize: FONT_SIZE.sm, color: COLORS.primary, fontWeight: '500', marginBottom: SPACING.xs },
  batchMeta: { flexDirection: 'row', alignItems: 'center' },
  batchMetaText: { fontSize: FONT_SIZE.xs, color: COLORS.textTertiary, marginLeft: 3 },
  batchDot: { fontSize: FONT_SIZE.xs, color: COLORS.textTertiary, marginHorizontal: SPACING.xs },
  unreadBadge: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.full,
    minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  unreadBadgeText: { color: COLORS.textInverse, fontSize: FONT_SIZE.xs, fontWeight: '700' },
  emptyContainer: { flex: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyTitle: { fontSize: FONT_SIZE.xl, fontWeight: '600', color: COLORS.text, marginTop: SPACING.lg },
  emptySubtitle: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.sm, textAlign: 'center', paddingHorizontal: SPACING.xxxl },
});
