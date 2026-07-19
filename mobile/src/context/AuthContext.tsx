/**
 * Authentication Context for TheHoneyBee Mobile App.
 * Mirrors web/src/context/AuthContext.jsx — handles Firebase auth,
 * role determination from Firestore, and session management.
 */
import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { onAuthStateChanged, signOut, User, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithCredential, OAuthProvider } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { Logger } from '../utils/logger';
import { registerForPushNotificationsAsync, sendPushTokenToBackend } from '../utils/pushNotifications';

const TAG = 'Auth';

export type UserRole = 'Admin' | 'Teacher' | 'Student' | null;

export interface AppUser {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
}

interface AuthContextType {
  currentUser: User | null;
  user: AppUser | null;
  userRole: UserRole;
  userStatus: string | null;
  userName: string | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  loginWithApple: (identityToken: string, rawName: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Determine user role by checking Admin, Teacher, Students Firestore collections.
 * Mirrors backend's getUserRoleAndName logic.
 */
async function getUserRoleAndName(email: string, nameFromAuth?: string, firebaseUid?: string): Promise<{ role: UserRole; name: string; status?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  Logger.debug(TAG, `Resolving role for: ${normalizedEmail}`);

  // Helper: ensure the uid field is set on the Firestore document
  const ensureUid = async (collectionName: string, docId: string, existingData: any) => {
    if (firebaseUid && !existingData.uid) {
      try {
        const { updateDoc, doc: firestoreDoc } = await import('firebase/firestore');
        await updateDoc(firestoreDoc(db, collectionName, docId), { uid: firebaseUid });
        Logger.info(TAG, `Stored uid ${firebaseUid} on ${collectionName}/${docId}`);
      } catch (e) {
        Logger.warn(TAG, `Could not store uid on ${collectionName}/${docId}`, e);
      }
    }
  };

  try {
    // 1. Check Admin collection
    const adminSnap = await getDocs(query(collection(db, 'Admin'), where('Gmail', '==', normalizedEmail)));
    if (!adminSnap.empty) {
      const data = adminSnap.docs[0].data();
      const name = data.name || normalizedEmail.split('@')[0];
      await ensureUid('Admin', adminSnap.docs[0].id, data);
      Logger.info(TAG, `Role resolved: Admin (${name})`);
      return { role: 'Admin', name };
    }

    // 2. Check Teacher collection
    const teacherSnap = await getDocs(query(collection(db, 'Teacher'), where('Gmail', '==', normalizedEmail)));
    if (!teacherSnap.empty) {
      const data = teacherSnap.docs[0].data();
      const name = data.name || normalizedEmail.split('@')[0];
      await ensureUid('Teacher', teacherSnap.docs[0].id, data);
      Logger.info(TAG, `Role resolved: Teacher (${name})`);
      return { role: 'Teacher', name };
    }

    // 3. Check Students collection
    const studentSnap = await getDocs(query(collection(db, 'Students'), where('Gmail', '==', normalizedEmail)));
    if (!studentSnap.empty) {
      const data = studentSnap.docs[0].data();
      const name = data.name || normalizedEmail.split('@')[0];
      await ensureUid('Students', studentSnap.docs[0].id, data);
      Logger.info(TAG, `Role resolved: Student (${name})`);
      return { role: 'Student', name, status: data.status || 'inactive' };
    }

    // 4. New student — create in Firestore
    Logger.info(TAG, `No existing role found, creating new Student record`);
    const newName = nameFromAuth || normalizedEmail.split('@')[0];
    await addDoc(collection(db, 'Students'), {
      Gmail: normalizedEmail,
      email: normalizedEmail,
      name: newName,
      uid: firebaseUid || '',
      role: 'student',
      status: 'active',
      createdAt: new Date(),
    });
    return { role: 'Student', name: newName, status: 'active' };
  } catch (error) {
    Logger.error(TAG, 'Error resolving user role', error);
    return { role: null, name: nameFromAuth || '', status: undefined };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [userStatus, setUserStatus] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Resolve user role from Firestore
  const resolveRole = useCallback(async (firebaseUser: User) => {
    try {
      const email = firebaseUser.email;
      if (!email) {
        Logger.warn(TAG, 'User has no email, cannot resolve role');
        return;
      }
      const { role, name, status } = await getUserRoleAndName(email, firebaseUser.displayName || undefined, firebaseUser.uid);
      setUserRole(role);
      setUserName(name);
      setUserStatus(status || null);
      setUser({
        uid: firebaseUser.uid,
        email: email,
        displayName: name || firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
      });
    } catch (error) {
      Logger.error(TAG, 'Error resolving role', error);
    }
  }, []);

  // Firebase Auth state listener
  useEffect(() => {
    Logger.info(TAG, 'Setting up auth state listener');
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setCurrentUser(firebaseUser);
      if (firebaseUser) {
        Logger.info(TAG, `Auth state changed: user logged in (${firebaseUser.email})`);
        await resolveRole(firebaseUser);
        
        // Setup push token automatically after successful authentication
        try {
          const token = await registerForPushNotificationsAsync();
          if (token) {
            await sendPushTokenToBackend(token);
          }
        } catch (e) {
          Logger.warn(TAG, 'Failed to setup push notifications', e);
        }
      } else {
        Logger.info(TAG, 'Auth state changed: user logged out');
        setUser(null);
        setUserRole(null);
        setUserName(null);
        setUserStatus(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [resolveRole]);

  const refreshUser = useCallback(async () => {
    if (currentUser) {
      await resolveRole(currentUser);
    }
  }, [currentUser, resolveRole]);

  const login = useCallback(async () => {
    if (currentUser) {
      await resolveRole(currentUser);
    }
  }, [currentUser, resolveRole]);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    Logger.info(TAG, `Attempting email login for: ${email}`);
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // Also send to backend for session cookie (needed for file operations)
      try {
        const idToken = await userCredential.user.getIdToken();
        await fetch(`${require('../config/env').ENV.API_URL}/api/auth/google-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
      } catch (e) {
        Logger.warn(TAG, 'Backend session creation failed (non-critical for mobile)', e);
      }
      await resolveRole(userCredential.user);
    } finally {
      setLoading(false);
    }
  }, [resolveRole]);

  const registerWithEmail = useCallback(async (email: string, password: string, name: string) => {
    Logger.info(TAG, `Attempting email registration for: ${email}`);
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });

      // Register with backend
      try {
        await fetch(`${require('../config/env').ENV.API_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.toLowerCase(), name, uid: userCredential.user.uid }),
        });
      } catch (e) {
        Logger.warn(TAG, 'Backend registration failed (non-critical, Firestore role will be created)', e);
      }

      await resolveRole(userCredential.user);
    } finally {
      setLoading(false);
    }
  }, [resolveRole]);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    Logger.info(TAG, 'Attempting Google login via credential');
    setLoading(true);
    try {
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      
      // Register with backend for session
      try {
        await fetch(`${require('../config/env').ENV.API_URL}/api/auth/google-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
      } catch (e) {
        Logger.warn(TAG, 'Backend session creation failed for Google', e);
      }
      
      await resolveRole(userCredential.user);
    } catch (error) {
      Logger.error(TAG, 'Google login error', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [resolveRole]);

  const loginWithApple = useCallback(async (identityToken: string, rawName: string | null) => {
    Logger.info(TAG, 'Attempting Apple login via credential');
    setLoading(true);
    try {
      const provider = new OAuthProvider('apple.com');
      const credential = provider.credential({
        idToken: identityToken,
      });
      const userCredential = await signInWithCredential(auth, credential);
      
      const displayName = rawName || userCredential.user.displayName || userCredential.user.email?.split('@')[0] || '';
      
      // Register with backend for session (using the google-login session handler, which accepts any Firebase ID token)
      try {
        const idToken = await userCredential.user.getIdToken();
        await fetch(`${require('../config/env').ENV.API_URL}/api/auth/google-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, name: displayName }),
        });
      } catch (e) {
        Logger.warn(TAG, 'Backend session creation failed for Apple', e);
      }
      
      await resolveRole(userCredential.user);
    } catch (error) {
      Logger.error(TAG, 'Apple login error', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [resolveRole]);


  const logout = useCallback(async () => {
    Logger.info(TAG, 'Logging out');
    setLoading(true);
    try {
      await signOut(auth);
      setUser(null);
      setUserRole(null);
      setUserStatus(null);
      setUserName(null);
      setCurrentUser(null);
    } catch (error) {
      Logger.error(TAG, 'Logout error', error);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        user,
        userRole,
        userStatus,
        userName,
        loading,
        login,
        logout,
        refreshUser,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        loginWithApple,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { getUserRoleAndName };
