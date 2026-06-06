/**
 * ShimmerPlaceholder — Reusable animated shimmer/skeleton loading component.
 * Provides chat list, batch list, student list, report list, and message shimmer variants.
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { COLORS, SPACING, RADIUS } from '../theme/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// --- Core Shimmer Bar ---
function ShimmerBar({ width, height = 12, style, borderRadius }: {
  width: number | string;
  height?: number;
  style?: any;
  borderRadius?: number;
}) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          backgroundColor: COLORS.skeleton,
          borderRadius: borderRadius ?? RADIUS.sm,
          opacity,
        },
        style,
      ]}
    />
  );
}

// --- Chat List Shimmer ---
export function ChatListShimmer({ count = 6 }: { count?: number }) {
  return (
    <View style={styles.container}>
      {/* Search bar shimmer */}
      <View style={styles.searchShimmer}>
        <ShimmerBar width="100%" height={40} borderRadius={RADIUS.md} />
      </View>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.chatItemShimmer}>
          <ShimmerBar width={50} height={50} borderRadius={25} />
          <View style={styles.chatInfoShimmer}>
            <View style={styles.chatTopShimmer}>
              <ShimmerBar width={120 + Math.random() * 60} height={14} />
              <ShimmerBar width={40} height={10} />
            </View>
            <ShimmerBar width={180 + Math.random() * 80} height={11} style={{ marginTop: 8 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

// --- Batch List Shimmer ---
export function BatchListShimmer({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.batchCardShimmer}>
          <View style={styles.batchHeaderShimmer}>
            <ShimmerBar width={44} height={44} borderRadius={RADIUS.md} />
            <View style={{ flex: 1, marginLeft: SPACING.md }}>
              <ShimmerBar width={140 + Math.random() * 60} height={15} />
              <ShimmerBar width={100 + Math.random() * 40} height={11} style={{ marginTop: 6 }} />
            </View>
            <ShimmerBar width={22} height={22} borderRadius={11} />
          </View>
          <View style={styles.batchMetaShimmer}>
            <ShimmerBar width={80} height={10} />
            <ShimmerBar width={60} height={10} />
          </View>
        </View>
      ))}
    </View>
  );
}

// --- Student List Shimmer ---
export function StudentListShimmer({ count = 6 }: { count?: number }) {
  return (
    <View style={styles.container}>
      {/* Stats bar shimmer */}
      <View style={styles.statsShimmer}>
        <ShimmerBar width={50} height={28} />
        <ShimmerBar width={50} height={28} />
        <ShimmerBar width={50} height={28} />
      </View>
      {/* Search shimmer */}
      <View style={[styles.searchShimmer, { marginHorizontal: SPACING.md }]}>
        <ShimmerBar width="100%" height={44} borderRadius={RADIUS.lg} />
      </View>
      {/* Filter chips shimmer */}
      <View style={styles.filterShimmer}>
        <ShimmerBar width={60} height={32} borderRadius={RADIUS.full} />
        <ShimmerBar width={60} height={32} borderRadius={RADIUS.full} />
        <ShimmerBar width={70} height={32} borderRadius={RADIUS.full} />
      </View>
      {/* Student cards */}
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.studentCardShimmer}>
          <ShimmerBar width={44} height={44} borderRadius={22} />
          <View style={{ flex: 1, marginLeft: SPACING.md }}>
            <ShimmerBar width={120 + Math.random() * 60} height={14} />
            <ShimmerBar width={160 + Math.random() * 40} height={11} style={{ marginTop: 4 }} />
            <ShimmerBar width={80} height={10} style={{ marginTop: 4 }} />
          </View>
          <ShimmerBar width={75} height={28} borderRadius={RADIUS.full} />
        </View>
      ))}
    </View>
  );
}

// --- Reports List Shimmer ---
export function ReportsListShimmer({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.container}>
      {/* Stats shimmer */}
      <View style={styles.statsShimmer}>
        <ShimmerBar width={50} height={28} />
        <ShimmerBar width={50} height={28} />
        <ShimmerBar width={50} height={28} />
        <ShimmerBar width={50} height={28} />
      </View>
      {/* Filter chips shimmer */}
      <View style={styles.filterShimmer}>
        <ShimmerBar width={50} height={32} borderRadius={RADIUS.full} />
        <ShimmerBar width={55} height={32} borderRadius={RADIUS.full} />
        <ShimmerBar width={60} height={32} borderRadius={RADIUS.full} />
      </View>
      {/* Report cards */}
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.reportCardShimmer}>
          <View style={styles.reportHeaderShimmer}>
            <ShimmerBar width={60} height={22} borderRadius={RADIUS.full} />
            <View style={{ flex: 1, marginLeft: SPACING.sm }}>
              <ShimmerBar width={100 + Math.random() * 60} height={13} />
              <ShimmerBar width={80} height={11} style={{ marginTop: 4 }} />
            </View>
            <ShimmerBar width={60} height={10} />
          </View>
          <ShimmerBar width="90%" height={11} style={{ marginTop: SPACING.sm }} />
          <ShimmerBar width="70%" height={11} style={{ marginTop: 6 }} />
        </View>
      ))}
    </View>
  );
}

// --- Messages Shimmer (for chat/batch chat) ---
export function MessagesShimmer({ count = 8 }: { count?: number }) {
  return (
    <View style={styles.messagesContainer}>
      {Array.from({ length: count }).map((_, i) => {
        const isSent = i % 3 === 0;
        const bubbleWidth = 140 + Math.random() * 100;
        return (
          <View
            key={i}
            style={[
              styles.messageBubbleShimmer,
              isSent ? styles.messageSent : styles.messageReceived,
            ]}
          >
            {!isSent && <ShimmerBar width={70} height={10} style={{ marginBottom: 4 }} />}
            <ShimmerBar width={bubbleWidth} height={14} />
            <ShimmerBar width={bubbleWidth * 0.6} height={12} style={{ marginTop: 4 }} />
            <ShimmerBar width={35} height={8} style={{ marginTop: 6, alignSelf: 'flex-end' }} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  searchShimmer: {
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.md,
  },
  chatItemShimmer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.borderLight,
  },
  chatInfoShimmer: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  chatTopShimmer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  batchCardShimmer: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
  },
  batchHeaderShimmer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  batchMetaShimmer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.borderLight,
  },
  statsShimmer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  filterShimmer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
    gap: SPACING.sm,
  },
  studentCardShimmer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
  },
  reportCardShimmer: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
  },
  reportHeaderShimmer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messagesContainer: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  messageBubbleShimmer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    maxWidth: '75%',
  },
  messageSent: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(18, 125, 142, 0.08)',
    borderBottomRightRadius: SPACING.xs,
  },
  messageReceived: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: SPACING.xs,
  },
});
