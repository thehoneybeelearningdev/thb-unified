/**
 * PaymentReminderModal — Shows a payment reminder to students
 * whose paymentStatus is not 'paid' on every app open.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS } from '../theme/theme';
import { Logger } from '../utils/logger';

const TAG = 'PaymentReminder';

export default function PaymentReminderModal() {
  const { currentUser, userRole } = useAuth();
  const [visible, setVisible] = useState(false);
  const [studentName, setStudentName] = useState('');
  const scaleAnim = useState(new Animated.Value(0.8))[0];

  useEffect(() => {
    if (!currentUser?.email || userRole?.toLowerCase() !== 'student') return;

    const checkPayment = async () => {
      try {
        const email = currentUser.email?.toLowerCase();
        if (!email) return;

        const q = query(
          collection(db, 'Students'),
          where('Gmail', '==', email)
        );
        const snap = await getDocs(q);
        if (snap.empty) return;

        const data = snap.docs[0].data();
        const paymentStatus = (data.paymentStatus || 'unpaid').toLowerCase();
        const name = data.name || data.Name || '';
        setStudentName(name);

        if (paymentStatus !== 'paid') {
          setVisible(true);
          Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 65,
            friction: 8,
            useNativeDriver: true,
          }).start();
          Logger.info(TAG, `Payment reminder shown for ${email} (status: ${paymentStatus})`);
        }
      } catch (error) {
        Logger.error(TAG, 'Error checking payment status', error);
      }
    };

    // Small delay so it doesn't block initial render
    const timer = setTimeout(checkPayment, 1500);
    return () => clearTimeout(timer);
  }, [currentUser?.email, userRole]);

  const handleDismiss = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.8,
      duration: 150,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="alert-circle" size={48} color={COLORS.warning} />
          </View>

          {/* Title */}
          <Text style={styles.title}>Payment Due</Text>

          {/* Message */}
          <Text style={styles.message}>
            {studentName ? `Hi ${studentName}, your` : 'Your'} payment for this month is pending.
            Please clear your dues to continue uninterrupted access.
          </Text>

          {/* Info */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
            <Text style={styles.infoText}>
              Contact your admin if you've already made the payment.
            </Text>
          </View>

          {/* Dismiss */}
          <TouchableOpacity style={styles.button} onPress={handleDismiss} activeOpacity={0.8}>
            <Text style={styles.buttonText}>OK, Got it</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xxl,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    ...SHADOWS.lg,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  message: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryFaded,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.xl,
  },
  infoText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    marginLeft: SPACING.sm,
    flex: 1,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xxxl,
    borderRadius: RADIUS.full,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: COLORS.textInverse,
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
});
