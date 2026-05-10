# Test Plan: Batch Group Assignment Chat Visibility Fix

## Issue Summary
Students registered via landing page don't see batch chats, while admin-created students do.

## Root Cause Identified
1. **Landing page students**: Missing `uid` field in Firestore document
2. **Admin-created students**: Include `uid` field in Firestore document  
3. **Student doc ID resolution**: Failed for landing page students due to missing `uid`
4. **Batch filtering**: Couldn't match landing page students to batch assignments

## Fixes Applied

### 1. Enhanced Student Document ID Resolution (Sidebar.jsx)
- Added fallback queries to find students by `Gmail` and `email` fields
- Improved error handling and logging
- Added direct document ID matching for batch filtering

### 2. Fixed Registration Endpoints
- **Frontend**: Changed from `/api/auth/google-login` to `/api/auth/register` for email registration
- **Backend**: Enhanced registration to include `uid`, `email`, `role`, and `status` fields
- **Google Login**: Added consistency fields for new student creation

### 3. Improved Batch Filtering Logic
- Added direct document ID matching as fallback
- Enhanced normalization logic for different student ID formats

## Test Scenarios

### Scenario 1: Landing Page Registration + Batch Assignment
1. **Setup**: Register a new student via landing page (email/password)
2. **Verify**: Student document created with all required fields including `uid`
3. **Action**: Admin assigns student to a batch via Batch Group Assignment
4. **Expected**: Student sees the batch chat in their /chat UI
5. **Verify**: Teacher also sees the batch chat

### Scenario 2: Admin-Created Student + Batch Assignment  
1. **Setup**: Admin creates student via /admin -> User Management
2. **Action**: Admin assigns student to a batch via Batch Group Assignment
3. **Expected**: Student sees the batch chat in their /chat UI (should work as before)
4. **Verify**: Teacher also sees the batch chat

### Scenario 3: Mixed Batch Assignment
1. **Setup**: Create one student via landing page, one via admin
2. **Action**: Assign both students to the same batch
3. **Expected**: Both students see the batch chat
4. **Verify**: Teacher sees the batch chat with both students

### Scenario 4: Google Login + Batch Assignment
1. **Setup**: Register student via Google login
2. **Action**: Admin assigns student to a batch
3. **Expected**: Student sees the batch chat
4. **Verify**: Student document includes proper fields

## Manual Testing Steps

### Pre-Test Setup
1. Ensure you have admin access
2. Have a test course and teacher available
3. Clear browser cache/localStorage if needed

### Test Execution

#### Test 1: Landing Page Student
```
1. Go to landing page registration
2. Register with: test-student-1@example.com / password123 / "Test Student 1"
3. Login as admin
4. Go to /admin -> Batch Group Assignment
5. Create new batch with test course, teacher, and the new student
6. Logout admin, login as test-student-1@example.com
7. Go to /chat -> Batch Broadcasts
8. VERIFY: Batch appears in the list
9. Click on batch
10. VERIFY: Can see batch chat interface
```

#### Test 2: Admin-Created Student  
```
1. Login as admin
2. Go to /admin -> User Management
3. Add new student: test-student-2@example.com / password123 / "Test Student 2"
4. Go to /admin -> Batch Group Assignment  
5. Create new batch with test course, teacher, and the new student
6. Logout admin, login as test-student-2@example.com
7. Go to /chat -> Batch Broadcasts
8. VERIFY: Batch appears in the list
```

#### Test 3: Mixed Batch
```
1. Use students from Test 1 and Test 2
2. Login as admin
3. Go to /admin -> Batch Group Assignment
4. Create new batch with both students
5. Test both student logins
6. VERIFY: Both see the same batch chat
```

## Database Verification Queries

### Check Student Document Structure
```javascript
// In Firestore console or Firebase CLI
db.collection('Students').where('Gmail', '==', 'test-student-1@example.com').get()
// Should show: Gmail, email, name, uid, role, status, createdAt
```

### Check Batch Assignment
```javascript
// Find batch with test students
db.collection('batches').where('students', 'array-contains', '<student-doc-id>').get()
```

### Check Student Doc ID Resolution
```javascript
// Test the resolution logic manually
const email = 'test-student-1@example.com';
// Try each resolution method from Sidebar.jsx
```

## Expected Results After Fix
- ✅ Landing page students see batch chats after assignment
- ✅ Admin-created students continue to see batch chats  
- ✅ Mixed batches work for all student types
- ✅ No regression in existing functionality
- ✅ Consistent student document structure across registration methods

## Rollback Plan
If issues occur:
1. Revert Sidebar.jsx changes
2. Revert authController.js changes  
3. Revert Login.jsx changes
4. Test with original code to confirm rollback

## Notes
- Changes are backward compatible
- Existing student documents will work with enhanced resolution logic
- New registrations will have consistent document structure
- No database migration required
