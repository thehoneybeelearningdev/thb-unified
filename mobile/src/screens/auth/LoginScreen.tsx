/**
 * Login Screen for TheHoneyBee Mobile App.
 * Premium, WhatsApp-inspired login with Google and email/password auth.
 */
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Image, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS } from '../../theme/theme';
import { auth } from '../../config/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';

// Configure Google Sign-In (web client ID is required for Firebase)
GoogleSignin.configure({
  webClientId: '509238464463-tnvut4occp8r32nm8qg1koc7o7a7qgmg.apps.googleusercontent.com',
  iosClientId: '509238464463-nchj49bns2p9sgrku2i91be9gbhnq7e3.apps.googleusercontent.com',
  offlineAccess: false,
});

const { width } = Dimensions.get('window');

type AuthMode = 'login' | 'register' | 'forgotPassword';

export default function LoginScreen() {
  const { loginWithEmail, registerWithEmail, loginWithGoogle, loginWithApple, loading } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleGoogleLogin = async () => {
    setSubmitting(true);
    try {
      await GoogleSignin.hasPlayServices();
      const result = await GoogleSignin.signIn();
      if (!isSuccessResponse(result)) {
        Toast.show({ type: 'info', text1: 'Google Sign-In cancelled' });
        return;
      }
      const { idToken } = result.data;
      if (!idToken) throw new Error('No ID token returned from Google');
      await loginWithGoogle(idToken);
      Toast.show({ type: 'success', text1: 'Logged in with Google!' });
    } catch (error: any) {
      if (error.code !== 'SIGN_IN_CANCELLED') {
        Toast.show({ type: 'error', text1: 'Google Login failed', text2: error?.message || 'Please try again.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAppleLogin = async () => {
    setSubmitting(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      
      if (!credential.identityToken) {
        throw new Error('No identity token returned from Apple Sign-In');
      }

      let rawName = null;
      if (credential.fullName) {
        const { givenName, familyName } = credential.fullName;
        rawName = [givenName, familyName].filter(Boolean).join(' ').trim();
      }

      await loginWithApple(credential.identityToken, rawName || null);
      Toast.show({ type: 'success', text1: 'Logged in with Apple!' });
    } catch (error: any) {
      if (error.code !== 'ERR_REQUEST_CANCELED') {
        Toast.show({ type: 'error', text1: 'Apple Login failed', text2: error?.message || 'Please try again.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Toast.show({ type: 'error', text1: 'Please fill all fields' });
      return;
    }
    setSubmitting(true);
    try {
      await loginWithEmail(email.trim().toLowerCase(), password);
      Toast.show({ type: 'success', text1: 'Logged in successfully!' });
    } catch (error: any) {
      const code = error?.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        Toast.show({ type: 'error', text1: 'Invalid credentials', text2: 'Email or password is incorrect.' });
      } else if (code === 'auth/user-not-found') {
        Toast.show({ type: 'error', text1: 'No account found', text2: 'No account found with this email.' });
      } else if (code === 'auth/invalid-email') {
        Toast.show({ type: 'error', text1: 'Invalid email format' });
      } else {
        Toast.show({ type: 'error', text1: 'Login failed', text2: error?.message || 'Please try again.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Toast.show({ type: 'error', text1: 'Please fill all fields' });
      return;
    }
    if (password.length < 6) {
      Toast.show({ type: 'error', text1: 'Password too short', text2: 'Password must be at least 6 characters.' });
      return;
    }
    setSubmitting(true);
    try {
      await registerWithEmail(email.trim().toLowerCase(), password, name.trim());
      Toast.show({ type: 'success', text1: 'Account created!', text2: 'Welcome to TheHoneyBee!' });
    } catch (error: any) {
      const code = error?.code || '';
      if (code === 'auth/email-already-in-use') {
        Toast.show({ type: 'error', text1: 'Email already registered', text2: 'Try logging in instead.' });
      } else {
        Toast.show({ type: 'error', text1: 'Registration failed', text2: error?.message || 'Please try again.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Toast.show({ type: 'error', text1: 'Enter your email address' });
      return;
    }
    setSubmitting(true);
    const lowerEmail = email.trim().toLowerCase();
    try {
      // 1. Try to hit backend forgot-password endpoint first to ensure user exists in Firebase Auth
      try {
        await fetch(`${ENV.API_URL}/api/auth/forgot-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: lowerEmail }),
        });
      } catch (backendError) {
        console.warn('[handleForgotPassword] Backend prep failed (non-critical):', backendError);
      }

      // 2. Call Firebase Auth to send the reset email
      await sendPasswordResetEmail(auth, lowerEmail);
      Toast.show({ type: 'success', text1: 'Reset link sent', text2: 'Check your inbox for the reset link.' });
      setMode('login');
    } catch (error) {
      console.error('[handleForgotPassword] Firebase sendPasswordResetEmail failed:', error);
      // Always show success to prevent email enumeration
      Toast.show({ type: 'success', text1: 'Reset link sent', text2: 'If an account exists, a reset link has been sent.' });
      setMode('login');
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = loading || submitting;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header / Branding */}
        <View style={styles.brandSection}>
          <Image
            source={require('../../../assets/thb-with-bg.jpeg')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {mode === 'login' ? 'Welcome Back' :
              mode === 'register' ? 'Create Account' :
                'Reset Password'}
          </Text>

          {mode !== 'forgotPassword' && (
            <Text style={styles.cardSubtitle}>
              {mode === 'login' ? (
                <>
                  New user?{' '}
                  <Text style={styles.link} onPress={() => setMode('register')}>Register Now</Text>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <Text style={styles.link} onPress={() => setMode('login')}>Log in</Text>
                </>
              )}
            </Text>
          )}

          {mode === 'forgotPassword' && (
            <Text style={styles.cardSubtitle}>
              Enter your email to receive a password reset link.
            </Text>
          )}

          {/* Registration name field */}
          {mode === 'register' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor={COLORS.textTertiary}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>
          )}

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="email@example.com"
              placeholderTextColor={COLORS.textTertiary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Password (not for forgot password) */}
          {mode !== 'forgotPassword' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Enter password"
                  placeholderTextColor={COLORS.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(v => !v)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={COLORS.primary}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Forgot password link */}
          {mode === 'login' && (
            <TouchableOpacity
              onPress={() => setMode('forgotPassword')}
              style={styles.forgotContainer}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          {/* Submit button */}
          <TouchableOpacity
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
            onPress={
              mode === 'login' ? handleLogin :
                mode === 'register' ? handleRegister :
                  handleForgotPassword
            }
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.textInverse} />
            ) : (
              <Text style={styles.submitButtonText}>
                {mode === 'login' ? 'Sign In' :
                  mode === 'register' ? 'Sign Up' :
                    'Send Reset Link'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Google Sign-In button */}
          {mode === 'login' && (
            <>
              <View style={styles.dividerContainer}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.divider} />
              </View>

              <TouchableOpacity
                style={styles.googleButton}
                onPress={handleGoogleLogin}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <Ionicons name="logo-google" size={20} color={COLORS.text} style={styles.googleIcon} />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </TouchableOpacity>

              {Platform.OS === 'ios' && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={RADIUS.md}
                  style={styles.appleButton}
                  onPress={handleAppleLogin}
                />
              )}
            </>
          )}

          {/* Back to login from forgot password */}
          {mode === 'forgotPassword' && (
            <TouchableOpacity
              onPress={() => setMode('login')}
              style={styles.backToLoginContainer}
            >
              <Text style={styles.backToLoginText}>← Back to Login</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xxxl,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: SPACING.xxxl,
  },
  logoImage: {
    width: width * 0.8,
    height: 120,
    marginBottom: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xxl,
    ...SHADOWS.lg,
  },
  cardTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  cardSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xl,
  },
  link: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: Platform.OS === 'ios' ? SPACING.md : SPACING.sm,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: Platform.OS === 'ios' ? SPACING.md : SPACING.sm,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  eyeButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  forgotContainer: {
    alignItems: 'flex-end',
    marginBottom: SPACING.lg,
    marginTop: -SPACING.sm,
  },
  forgotText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
    ...SHADOWS.md,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.textInverse,
  },
  backToLoginContainer: {
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  backToLoginText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: '500',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    marginHorizontal: SPACING.md,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  googleButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIcon: {
    marginRight: SPACING.sm,
  },
  googleButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  appleButton: {
    width: '100%',
    height: 48,
    marginTop: SPACING.md,
  },
});
