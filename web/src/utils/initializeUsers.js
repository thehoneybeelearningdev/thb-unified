import { db, auth } from '../services/firebase';
import { collection, doc, setDoc, getDocs, query, where } from 'firebase/firestore';

// Function to initialize sample users in Firestore
export const initializeSampleUsers = async () => {
  try {
    // Check if users collection already has data
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    
    if (snapshot.size > 0) {
      return;
    }
    
    // Sample users data
    const sampleUsers = [
      {
        uid: 'sarah_johnson_uid',
        displayName: 'Sarah Johnson',
        email: 'sarah@example.com',
        role: 'Teacher',
        photoURL: null
      },
      {
        uid: 'john_doe_uid',
        displayName: 'John Doe',
        email: 'john@example.com',
        role: 'Student',
        photoURL: null
      },
      {
        uid: 'alice_smith_uid',
        displayName: 'Alice Smith',
        email: 'alice@example.com',
        role: 'Student',
        photoURL: null
      },
      {
        uid: 'bob_brown_uid',
        displayName: 'Bob Brown',
        email: 'bob@example.com',
        role: 'Student',
        photoURL: null
      }
    ];
    
    // Add sample users to Firestore
    for (const user of sampleUsers) {
      await setDoc(doc(db, 'users', user.uid), user);
    }
  } catch (error) {
    // Error initializing sample users
  }
};

// Function to add the current authenticated user to Firestore
export const addCurrentUserToFirestore = async () => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return;
    }
    
    // Check if user already exists in Firestore
    const userRef = doc(db, 'users', currentUser.uid);
    
    // Add or update user in Firestore
    await setDoc(userRef, {
      uid: currentUser.uid,
      displayName: currentUser.displayName || 'User',
      email: currentUser.email,
      role: 'Student', // Default role
      photoURL: currentUser.photoURL,
      lastLogin: new Date().toISOString()
    }, { merge: true }); // Use merge to update existing user
  } catch (error) {
    // Error adding current user to Firestore
  }
};