/**
 * Error Boundary component for crash recovery.
 */
import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../theme/theme';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  private originalHandler: any;

  componentDidMount() {
    const globalAny: any = global;
    // Hook into React Native's global error handler to catch non-React errors
    if (typeof globalAny.ErrorUtils !== 'undefined') {
      this.originalHandler = globalAny.ErrorUtils.getGlobalHandler();
      globalAny.ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
        this.setState({ hasError: true, error });
        // In dev, we still want to see the redbox
        if (__DEV__ && this.originalHandler) {
          this.originalHandler(error, isFatal);
        }
      });
    }
  }

  componentWillUnmount() {
    const globalAny: any = global;
    if (typeof globalAny.ErrorUtils !== 'undefined' && this.originalHandler) {
      globalAny.ErrorUtils.setGlobalHandler(this.originalHandler);
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Ionicons name="alert-circle-outline" size={64} color={COLORS.error} />
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            The app encountered an unexpected error. Please try again.
          </Text>
          {this.state.error && (
            <Text style={styles.errorDetail}>{this.state.error.message || String(this.state.error)}</Text>
          )}
          <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.background, padding: SPACING.xxl,
  },
  title: {
    fontSize: FONT_SIZE.xxl, fontWeight: '700', color: COLORS.text,
    marginTop: SPACING.lg, marginBottom: SPACING.sm,
  },
  message: {
    fontSize: FONT_SIZE.md, color: COLORS.textSecondary,
    textAlign: 'center', marginBottom: SPACING.xl,
  },
  errorDetail: {
    fontSize: FONT_SIZE.xs, color: COLORS.error,
    textAlign: 'center', marginBottom: SPACING.xl, fontFamily: 'monospace',
  },
  retryButton: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.xxxl,
  },
  retryText: {
    fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.textInverse,
  },
});
