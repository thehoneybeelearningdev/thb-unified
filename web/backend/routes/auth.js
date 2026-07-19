// Import Express framework to create our routes
// Routes are like "addresses" that tell the server where to send different types of requests
const express = require('express');

// Import our authentication controller functions
// Controllers contain the actual logic for handling requests (like login processing)
const { handleGoogleLogin, logout, getUserRoleAndName, handleEmailRegister, setTeacherPassword, teacherLogin, teacherExists, forgotPassword } = require('../controllers/authController');

// Import middleware for session verification
const verifySessionCookie = require('../middleware/authMiddleware');

// Import Firebase Admin for user role and name lookup
const { db, auth: adminAuth } = require('../config/firebaseAdmin');

// Create a router instance
// A router is like a traffic director - it takes incoming requests and sends them to the right handler
const router = express.Router();

// Define our authentication routes
// This creates a POST endpoint at '/google-login'
// When someone sends a POST request to '/api/auth/google-login', it will call the handleGoogleLogin function
router.post('/google-login', handleGoogleLogin);

// Add a POST endpoint for logout
router.post('/logout', logout);

// User info endpoint
router.get('/me', verifySessionCookie, async (req, res) => {
  const email = req.user.email.toLowerCase();
  const nameFromToken = req.user.name;

  // **THE FIX IS HERE:** Capture both `role` and `name` from your helper.
  const { role, name } = await getUserRoleAndName(email, nameFromToken);

  // Now, send the correct `name` from the database in the response.
  res.json({ user: req.user, role, name });
});

// Registration endpoint (for email/password)
router.post('/register', handleEmailRegister);

// Teacher exists endpoint
router.get('/teachers/exists', teacherExists);

// Teacher password setup endpoint
router.post('/teachers/set-password', setTeacherPassword);
router.post('/teachers/login', teacherLogin);

// Forgot password endpoint
router.post('/forgot-password', forgotPassword);

// Delete account endpoint
router.post('/delete-account', verifySessionCookie, async (req, res) => {
  const email = req.user.email.toLowerCase();
  const uid = req.user.uid;
  console.log(`[DeleteAccount] Request to delete account: ${email} (uid: ${uid})`);

  try {
    // 1. Delete documents from collections where Gmail or email matches
    const collections = ['Admin', 'Teacher', 'Students'];
    for (const col of collections) {
      let snap = await db.collection(col).where('Gmail', '==', email).get();
      for (const doc of snap.docs) {
        await doc.ref.delete();
        console.log(`[DeleteAccount] Deleted ${col} document for ${email}`);
      }
      
      let snap2 = await db.collection(col).where('email', '==', email).get();
      for (const doc of snap2.docs) {
        await doc.ref.delete();
        console.log(`[DeleteAccount] Deleted ${col} document (by email field) for ${email}`);
      }

      if (uid) {
        let snap3 = await db.collection(col).where('uid', '==', uid).get();
        for (const doc of snap3.docs) {
          await doc.ref.delete();
          console.log(`[DeleteAccount] Deleted ${col} document (by uid field) for ${email}`);
        }
      }
    }

    // 2. Delete user from Firebase Auth
    if (uid) {
      await adminAuth.deleteUser(uid);
      console.log(`[DeleteAccount] Deleted Auth user from Firebase: ${email}`);
    }

    // 3. Clear session cookie (for web compatibility)
    res.clearCookie('session', {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "None",
      domain: ".thehoneybeelearning.in",
    });

    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error(`[DeleteAccount] Error deleting account for ${email}:`, error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// Export the router so it can be used in our main server file
// This connects our routes to the main Express application
module.exports = router;
