"use client"
import { useState, useEffect } from "react"
import { FiMessageCircle, FiTrash2, FiUser, FiUserCheck, FiAlertCircle, FiBookOpen, FiClock, FiVideo } from "react-icons/fi"
import { db } from "../../services/firebase"
import { collection, onSnapshot, query, doc, deleteDoc, addDoc, updateDoc, serverTimestamp, where, getDocs, getDoc} from "firebase/firestore"
import { createChatNotifications, resolveUserIdentifier } from "../../utils/notificationUtils"

export default function ChatAssignment() {
  const [chats, setChats] = useState([])
  const [students, setStudents] = useState([])
  const [teachers, setTeachers] = useState([])
  const [courses, setCourses] = useState([]) 
  const [selectedStudent, setSelectedStudent] = useState("")
  const [selectedTeacher, setSelectedTeacher] = useState("")
  const [selectedCourse, setSelectedCourse] = useState("")
  const [sessionLimit, setSessionLimit] = useState("")
  const [allowZoomLink, setAllowZoomLink] = useState(false)
  const [toast, setToast] = useState({ show: false, message: "", type: "" })
  const [loading, setLoading] = useState({
    courses: true
  })
  const [error, setError] = useState({
    courses: null
  })
  // NEW: State for session information
  const [chatSessions, setChatSessions] = useState({})
  // NEW: Real-time ticker to detect when sessions end
  const [nowTick, setNowTick] = useState(Date.now())
  const [activeTab, setActiveTab] = useState('chats')
  const [queries, setQueries] = useState([])

  // Fetch Admin queries and resolve user details from Students/Teachers collections
  const fetchQueries = async () => {
   
    try {
      // Get all admin queries

      const q = query(collection(db, 'chats'), where('name', '==', 'Admin'));
      const querySnapshot = await getDocs(q);
      
     
      const queriesData = [];
      
      // Process each query and collect user IDs
      querySnapshot.forEach((doc, index) => {
        const data = doc.data();
        const userId = data.studentId || data.userId;
      
        
        queriesData.push({
          id: doc.id,
          ...data,
          timestamp: data.createdAt || serverTimestamp(),
          createdDate: data.createdAt?.toDate ? data.createdAt.toDate().toISOString().split('T')[0] : 'N/A',
          // Store studentId for user lookup
          userId: userId
        });
      });

      // Get unique user IDs
      const userIds = [...new Set(queriesData.map(q => q.userId).filter(Boolean))];
     
      
      // Function to fetch user data from a specific collection
      const fetchUserData = async (collectionName, isTeacher = false) => {
        if (userIds.length === 0) return new Map();
        
        // For teachers, we need to find by email in the document data
        if (isTeacher) {
          // First get all teacher emails
          const teacherEmails = [];
          const teacherDocs = [];
          
          for (const userId of userIds) {
            try {
              // If it's a teacher ID (or not an email), try to get directly
              if (userId && !userId.includes('@')) {
                const teacherDoc = await getDoc(doc(db, collectionName, userId));
                if (teacherDoc.exists()) {
                  teacherDocs.push({
                    id: teacherDoc.id,
                    ...teacherDoc.data(),
                    isTeacher: true
                  });
                }
              }
              
              // Also try to find by email in the Users collection
              const userDoc = await getDoc(doc(db, 'Users', userId));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                if (userData.email) {
                  teacherEmails.push(userData.email);
                }
              }
            } catch (err) {
             
            }
          }
          
          // If we have emails, search for teachers with those emails
          if (teacherEmails.length > 0) {
            const teacherQuery = query(
              collection(db, collectionName),
              where('email', 'in', teacherEmails)
            );
            const teacherSnapshot = await getDocs(teacherQuery);
            teacherSnapshot.forEach(teacherDoc => {
              teacherDocs.push({
                id: teacherDoc.id,
                ...teacherDoc.data(),
                isTeacher: true
              });
            });
          }
          
          // Create a map of user ID to teacher data
          const userMap = new Map();
          for (const teacher of teacherDocs) {
            // Try to find the user ID that matches this teacher's email
            for (const userId of userIds) {
              const userDoc = await getDoc(doc(db, 'Users', userId));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                if (userData.email === teacher.email) {
                  userMap.set(userId, {
                    name: teacher.name || teacher.fullName || 'Unknown Teacher',
                    email: teacher.email || 'No email',
                    role: 'Teacher',
                    ...teacher
                  });
                  break;
                }
              }
            }
          }
          return userMap;
        } 
        // For students, we can query directly by ID
        else {
          const studentDocs = [];
          for (const userId of userIds) {
            try {
              const studentDoc = await getDoc(doc(db, collectionName, userId));
              if (studentDoc.exists()) {
                const data = studentDoc.data();
                studentDocs.push({
                  id: studentDoc.id,
                  name: data.name || data.fullName || 'Unknown Student',
                  email: data.email || data.Gmail || 'No email',
                  role: 'Student',
                  ...data
                });
              }
            } catch (err) {
              
            }
          }
          return new Map(studentDocs.map(s => [s.id, s]));
        }
      };

      // Fetch data from both collections in parallel
    
      const [teachersData, studentsData] = await Promise.all([
        fetchUserData('Teachers', true),
        fetchUserData('Students')
      ]);



      // Combine the data, with teachers taking precedence
      const usersMap = new Map([...studentsData, ...teachersData]);
    

      // Function to find user by email in a collection
      const findUserByEmail = async (collectionName, email) => {
        if (!email || email === 'No email') return null;
        
        try {
          const q = query(collection(db, collectionName), where('email', '==', email));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name || data.fullName || (collectionName === 'Teacher' ? 'Teacher' : 'Student'),
              email: data.email || email,
              role: collectionName === 'Teacher' ? 'Teacher' : 'Student',
              source: collectionName,
              ...data
            };
          }
          return null;
        } catch (err) {

          return null;
        }
      };

      // Function to get user data from Students/Teachers collections
      const getUserFromCollections = async (userId, email) => {
        try {
          // First try to find in Teachers collection by ID (if not an email)
          if (userId && !userId.includes('@')) {
            const teacherDoc = await getDoc(doc(db, 'Teacher', userId));
            if (teacherDoc.exists()) {
              const teacherData = teacherDoc.data();
              return {
                name: teacherData.name || teacherData.fullName || 'Teacher',
                email: teacherData.email || email || 'No email',
                role: 'Teacher',
                source: 'Teacher (by ID)',
                ...teacherData
              };
            }
          }
          
          // Try to find in Teacher collection by email
          if (email && email !== 'No email') {
            const teacherUser = await findUserByEmail('Teacher', email);
            if (teacherUser) return teacherUser;
            
            // If not found in Teacher, try Students collection by email
            const studentUser = await findUserByEmail('Students', email);
            if (studentUser) return studentUser;
          }
          
          // Try to find in Students collection by ID as fallback
          const studentDoc = await getDoc(doc(db, 'Students', userId));
          if (studentDoc.exists()) {
            const studentData = studentDoc.data();
            return {
              name: studentData.name || studentData.fullName || 'Student',
              email: studentData.email || studentData.Gmail || email || 'No email',
              role: 'Student',
              source: 'Students (by ID)',
              ...studentData
            };
          }
          
          return null;
          
        } catch (err) {
         
          return null;
        }
      };

      // Enrich queries with user data
      const enrichedQueries = await Promise.all(queriesData.map(async (query) => {
        // First get the user's email from the users collection
        let userEmail = 'No email';
        try {
          const userDoc = await getDoc(doc(db, 'users', query.userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            userEmail = userData.email || 'No email';

          }
        } catch (err) {
          
        }
        
        // Try to get user data from Students/Teachers collections
        const collectionUserData = await getUserFromCollections(query.userId, userEmail);
        
        // If found in collections, use that data
        if (collectionUserData) {
         
          
          return {
            ...query,
            userName: collectionUserData.name,
            userEmail: collectionUserData.email,
            userRole: collectionUserData.role,
            userData: collectionUserData
          };
        }
        
        // Fallback to existing data or defaults
        const userData = usersMap.get(query.userId) || {};
        return {
          ...query,
          userName: userData.name || 'User',
          userEmail: userEmail,
          userRole: 'Student', // Default role if not found in collections
          userData: userData
        };

        const enriched = {
          ...query,
          userName: userData.name || 'Unknown User',
          userEmail: userData.email || 'No email',
          userRole: userData.role || 'Unknown Role',
          userData: userData // Include full user data for debugging
        };
        
       
        
        return enriched;
      }));

    
      setQueries(enrichedQueries);
      
    } catch (err) {
    
      showToast('Failed to load queries', 'error');
    }
  };

  // Ticker to re-evaluate active sessions without data changes
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30000); // 30s
    return () => clearInterval(id);
  }, []);

  // Fetch queries when tab changes to queries
  useEffect(() => {
    if (activeTab === 'queries') {
      fetchQueries();
    }
  }, [activeTab]);

  // Fetch courses from both collections (courses and advancedCourses)
  useEffect(() => {
    setLoading(prev => ({ ...prev, courses: true }))
    setError(prev => ({ ...prev, courses: null }))
    
    // Create queries against both collections
    const regularCoursesRef = collection(db, "courses")
    const advancedCoursesRef = collection(db, "advancedCourses")
    
    // Set up real-time listeners for both collections
    const unsubscribeRegular = onSnapshot(
      query(regularCoursesRef),
      (querySnapshot) => {
        const regularCoursesData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          title: doc.data().name || doc.data().courseName || doc.data().title || "Unknown Course",
          status: doc.data().status || "active",
          courseType: "regular"
        }))
        
        // We'll combine the data in the second listener
        setLoading(prev => ({ ...prev, courses: false }))
        
        // Set up listener for advanced courses
        const unsubscribeAdvanced = onSnapshot(
          query(advancedCoursesRef),
          (querySnapshot) => {
            const advancedCoursesData = querySnapshot.docs.map(doc => ({
              id: doc.id,
              title: doc.data().name || doc.data().courseName || doc.data().title || "Unknown Course",
              status: doc.data().status || "active",
              courseType: "advanced"
            }))
            
            // Combine both course types and filter active ones
            const allCoursesData = [...regularCoursesData, ...advancedCoursesData]
            setCourses(allCoursesData.filter(course => course.status === "active"))
            setLoading(prev => ({ ...prev, courses: false }))
          },
          (err) => {
            // Even if advanced courses fail, we still have regular courses
            setCourses(regularCoursesData.filter(course => course.status === "active"))
            setError(prev => ({ ...prev, courses: "Failed to load advanced course data" }))
            setLoading(prev => ({ ...prev, courses: false }))
          }
        )
        
        // Return cleanup for advanced courses
        return () => unsubscribeAdvanced()
      },
      (err) => {
        setError(prev => ({ ...prev, courses: "Failed to load course data" }))
        setLoading(prev => ({ ...prev, courses: false }))
      }
    )

    // Clean up listener on unmount
    return () => unsubscribeRegular()
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'Students')),(snap)=>{
      const list = snap.docs.map(d=>({ id:d.id, uid:d.data().uid||d.id, name:d.data().name||'Unknown', email:d.data().Gmail||d.data().email||'', status:d.data().status||'active' }))
      setStudents(list.filter(s=>s.status==='active'))
    })
    return ()=>unsub()
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'Teacher')),(snap)=>{
      const list = snap.docs.map(d=>({ id:d.id, uid:d.data().uid||d.id, name:d.data().name||'Unknown', email:d.data().Gmail||d.data().email||'', status:d.data().status||'active' }))
      setTeachers(list.filter(t=>t.status==='active'))
    })
    return ()=>unsub()
  }, [])

  // Listen to chats collection directly
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'chats')), async (snap)=>{
      const chatDocs = snap.docs.map(d=>{
        const data = d.data()
        const createdAt = data.createdAt
        let createdDate = 'Unknown'
        if (createdAt && typeof createdAt.toDate === 'function') {
          try { createdDate = createdAt.toDate().toISOString().split('T')[0] } catch { /* ignore parse error */ }
        } else if (createdAt instanceof Date) {
          try { createdDate = createdAt.toISOString().split('T')[0] } catch { /* ignore parse error */ }
        }
        return {
          id: d.id,
          studentId: data.studentId,
          teacherId: data.teacherId,
          course: data.name || 'N/A',
          sessionLimit: data.sessionLimit !== undefined ? data.sessionLimit : 16,
          allowZoomLink: data.allowZoomLink || false,
          zoomLink: data.zoomLink || null,
          createdDate,
          status: data.status || 'active'
        }
      })
      
      // Resolve student and teacher names
      const resolved = chatDocs.map(chat => {
        const s = students.find(s => s.uid === chat.studentId || s.id === chat.studentId)
        const t = teachers.find(t => t.uid === chat.teacherId || t.id === chat.teacherId)
        return { 
          ...chat, 
          studentName: s?.name || 'Unknown Student', 
          teacherName: t?.name || 'Unknown Teacher' 
        }
      })
      setChats(resolved)
      
      // NEW: Fetch session information for each chat
      const sessionsData = {};
      for (const chat of resolved) {
        const sessionInfo = await checkChatSessions(chat.id);
        sessionsData[chat.id] = sessionInfo;
      }
      setChatSessions(sessionsData);
    })
    return ()=>unsub()
  }, [students, teachers])

  // NEW: Check for upcoming/active sessions for a specific chat
  const checkChatSessions = async (chatId) => {
    try {
      const bookingsRef = collection(db, 'bookings');
      const q = query(
        bookingsRef,
        where('chatId', '==', chatId),
        where('status', '==', 'approved')
      );
      const snap = await getDocs(q);
      const bookings = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Check if any bookings are upcoming or active using the same logic as Booking-request.jsx
      const now = new Date(nowTick);
      const hasActiveOrUpcoming = bookings.some(booking => {
        try {
          const dateStr = String(booking.date || '').trim();
          const timeStr = String(booking.time || '').trim();
          if (!dateStr || !timeStr.includes('-')) return false;
          
          const [startStr, endStr] = timeStr.split('-').map(s => s.trim());
          
          // Helper function to convert 12-hour format to 24-hour (same as Booking-request.jsx)
          const to24 = (timeStr) => {
            const trimmed = timeStr.trim();
            if (trimmed.includes('AM') || trimmed.includes('PM')) {
              const [time, meridian] = trimmed.split(' ');
              let [hours, minutes] = time.split(':').map(Number);
              
              if (meridian.toUpperCase() === 'PM' && hours !== 12) {
                hours += 12;
              } else if (meridian.toUpperCase() === 'AM' && hours === 12) {
                hours = 0;
              }
              
              return { h: hours, m: minutes };
            } else {
              const [hours, minutes] = trimmed.split(':').map(Number);
              return { h: hours, m: minutes };
            }
          };
          
          const { h: sh, m: sm } = to24(startStr);
          const { h: eh, m: em } = to24(endStr);
          const [y, mo, d] = dateStr.split('-').map(Number);
          
          // Create Date objects (month is 0-indexed in JavaScript)
          const start = new Date(y, mo - 1, d, sh, sm, 0, 0);
          const end = new Date(y, mo - 1, d, eh, em, 0, 0);
          
          // Session is active if current time is within the actual session window
          // This matches the logic from Booking-request.jsx
          const isActive = now >= start && now <= end;
          

          
          return isActive;
        } catch {
          return false;
        }
      });
      
      return { hasActiveOrUpcoming, totalBookings: bookings.length };
    } catch (error) {
      return { hasActiveOrUpcoming: false, totalBookings: 0 };
    }
  };

  // Check for orphaned chats (chats with deleted courses)
  const checkOrphanedChats = () => {
    const orphanedChats = chats.filter(chat => {
      const courseExists = courses.some(course => course.title === chat.course);
      return !courseExists;
    });
    return orphanedChats;
  };

  // NEW: Check for chats that should not be removed (have upcoming/active sessions)
  const checkProtectedChats = async () => {
    const protectedChats = [];
    for (const chat of chats) {
      const sessionInfo = await checkChatSessions(chat.id);
      // Only protect chats with active/upcoming sessions, regardless of session limit
      if (sessionInfo.hasActiveOrUpcoming) {
        protectedChats.push({ ...chat, sessionInfo });
      }
    }
    return protectedChats;
  };

  const handleCleanupOrphaned = async () => {
    const orphaned = checkOrphanedChats();
    if (orphaned.length === 0) {
      showToast('No orphaned chats found', 'info');
      return;
    }

    // NEW: Check if any orphaned chats have upcoming/active sessions
    const protectedOrphaned = [];
    for (const chat of orphaned) {
      const sessionInfo = await checkChatSessions(chat.id);
      // Only protect orphaned chats with active/upcoming sessions
      if (sessionInfo.hasActiveOrUpcoming) {
        protectedOrphaned.push({ ...chat, sessionInfo });
      }
    }

    if (protectedOrphaned.length > 0) {
      showToast(`${protectedOrphaned.length} orphaned chats have upcoming/active sessions and cannot be removed`, 'warning');
      return;
    }

    if (!confirm(`Found ${orphaned.length} chats with deleted courses. Remove them?`)) {
      return;
    }

    try {
      for (const chat of orphaned) {
        await deleteDoc(doc(db, 'chats', chat.id));
      }
      showToast(`Cleaned up ${orphaned.length} orphaned chats`, 'success');
    } catch (error) {
      showToast('Failed to clean up orphaned chats', 'error');
    }
  };

  const showToast = (message, type='info') => {
    setToast({ show:true, message, type });
    setTimeout(()=> setToast({ show:false, message:'', type:''}), 3000)
  }

  const handleAssign = async () => {
    if (!selectedStudent || !selectedTeacher || !selectedCourse) {
      showToast('Please select student, teacher and course','error')
      return
    }

    // Prevent creating chats with 0 session limit
    if (sessionLimit === '' || parseInt(sessionLimit) <= 0) {
      showToast('Session limit must be greater than 0','error')
      return
    }

    // Prevent duplicates by checking if chat already exists
    const chatsRef = collection(db, 'chats');
    const existingChatQuery = query(
      chatsRef,
      where('studentId', '==', selectedStudent),
      where('teacherId', '==', selectedTeacher),
      where('name', '==', selectedCourse)
    );
    const existingChatSnap = await getDocs(existingChatQuery);
    if (!existingChatSnap.empty) { 
      showToast('A chat for this student-teacher-course combination already exists','error'); 
      return 
    }

    try {
      // Create chat document directly
      const chatData = {
        studentId: selectedStudent,
        teacherId: selectedTeacher,
        name: selectedCourse,
        users: [selectedStudent, selectedTeacher, 'admin'],
        lastMessage: '',
        lastMessageTime: serverTimestamp(),
        unreadCount: { [selectedStudent]: 0, [selectedTeacher]: 0 },
        createdAt: serverTimestamp(),
        createdBy: 'admin',
        allowZoomLink: allowZoomLink, // This will trigger zoom link creation
        sessionLimit: parseInt(sessionLimit), // Must be > 0
        status: 'active'
      };

      const chatDocRef = await addDoc(chatsRef, chatData);

      // Create notifications for teacher and student (only for new chats)
      try {
        // Resolve teacher identifier for notifications
        const teacherNotificationId = await resolveUserIdentifier(selectedTeacher, 'teacher')

        // Resolve student identifier for notifications
        const studentNotificationId = await resolveUserIdentifier(selectedStudent, 'student')

        // Create chat notifications
        await createChatNotifications(
          teacherNotificationId,
          studentNotificationId,
          {
            chatId: chatDocRef.id,
            courseName: selectedCourse,
            sessionLimit: parseInt(sessionLimit),
            allowZoomLink: allowZoomLink
          }
        )
              } catch (notificationError) {
          // Don't fail the chat creation if notifications fail
        }

      showToast('Chat created successfully with zoom link support','success')
      setSelectedStudent(''); setSelectedTeacher(''); setSelectedCourse(''); setSessionLimit(''); setAllowZoomLink(false)
    } catch (err) {
      showToast('Failed to create chat','error')
    }
  }

  const handleUnassign = async (id) => {
    if (!confirm('Remove this chat?')) return
    try { 
      await deleteDoc(doc(db,'chats', id)); 
      showToast('Chat removed','success') 
    }
    catch(err){ showToast('Failed to remove','error') }
  }

  const toggleChatStatus = async (id, status) => {
    const newStatus = status === 'active' ? 'inactive' : 'active'
    try { await updateDoc(doc(db,'chats', id), { status:newStatus }); showToast(`Chat ${newStatus}`,'success') }
    catch(err){ showToast('Failed to update status','error') }
  }

  const handleDeleteQuery = async (id) => {
    if (!window.confirm('Are you sure you want to delete this query?')) return;
    
    try {
      await deleteDoc(doc(db, 'chats', id));
      setQueries(prev => prev.filter(q => q.id !== id));
      showToast('Query deleted successfully', 'success');
    } catch (err) {

      showToast('Failed to delete query', 'error');
    }
  };

  return (
    <div className="chat-assignment">
      <div className="page-header">
        <div>
          <h2>One-on-One Chat Management</h2>
          <p>Create and manage direct communication between students and teachers</p>
        </div>
      </div>

      <div className="tabs-container">
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'chats' ? 'active' : ''}`}
            onClick={() => setActiveTab('chats')}
          >
            <FiMessageCircle className="tab-icon" />
            <span>Existing Chats</span>
          </button>
          <button 
            className={`tab ${activeTab === 'queries' ? 'active' : ''}`}
            onClick={() => setActiveTab('queries')}
          >
            <FiAlertCircle className="tab-icon" />
            <span>User Queries</span>
            {queries.length > 0 && (
              <span className="tab-badge">{queries.length}</span>
            )}
          </button>
        </div>
      </div>

      {toast.show && (
        <div className={`toast-notification ${toast.type}`}>
          <FiAlertCircle />
          <span>{toast.message}</span>
        </div>
      )}

      <div className="assignment-form">
        <div className="form-card">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label"><FiUser /> Select Student</label>
              <select className="form-select" value={selectedStudent} onChange={e=>setSelectedStudent(e.target.value)}>
                <option value="">Choose a student...</option>
                {(() => {
                  // Allow all students
                  const eligible = students;
                  // De-duplicate by normalized email, then fall back to id
                  const normalize = s => String(s || '').toLowerCase().trim()
                  const byKey = new Map()
                  for (const s of eligible) {
                    const key = normalize(s.email) || String(s.id)
                    if (!byKey.has(key)) byKey.set(key, s)
                  }
                  const unique = Array.from(byKey.values())
                  unique.sort((a,b) => String(a.name||'').localeCompare(String(b.name||''), undefined, { sensitivity:'base' }))
                  return unique.map(s => (
                    <option key={s.id} value={s.uid || s.id}>{s.name}</option>
                  ))
                })()}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label"><FiUserCheck /> Select Teacher</label>
              <select className="form-select" value={selectedTeacher} onChange={e=>setSelectedTeacher(e.target.value)}>
                <option value="">Choose a teacher...</option>
                {(() => {
                  // Allow all teachers
                  const eligible = teachers;
                  // De-duplicate by normalized email, then fall back to id
                  const normalize = s => String(s || '').toLowerCase().trim()
                  const byKey = new Map()
                  for (const t of eligible) {
                    const key = normalize(t.email) || String(t.id)
                    if (!byKey.has(key)) byKey.set(key, t)
                  }
                  const unique = Array.from(byKey.values())
                  unique.sort((a,b)=> String(a.name||'').localeCompare(String(b.name||''), undefined, { sensitivity:'base' }))
                  return unique.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))
                })()}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label"><FiBookOpen /> Select Course</label>
              <select 
                className="form-select" 
                value={selectedCourse} 
                onChange={e=>setSelectedCourse(e.target.value)}
                disabled={loading.courses}
              >
                <option value="">Choose a course...</option>
                {loading.courses ? (
                  <option disabled>Loading courses...</option>
                ) : error.courses ? (
                  <option disabled>Error: {error.courses}</option>
                ) : courses.length === 0 ? (
                  <option disabled>No courses available</option>
                ) : (
                  courses.map(course => (
                    <option key={course.id} value={course.title}>{course.title}</option>
                  ))
                )}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label"><FiClock /> Session Limit (hours)</label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="16"
                value={sessionLimit} 
                onChange={e=>setSessionLimit(e.target.value)}
                min="1"
                max="100"
                required
              />
             
            </div>

            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={allowZoomLink} 
                  onChange={e=>setAllowZoomLink(e.target.checked)}
                  className="checkbox-input"
                />
                <FiVideo className="checkbox-icon" />
                Allow Zoom Dynamic Link
              </label>
            </div>

            <div>
              <button className="btn btn-primary assign-btn" onClick={handleAssign}>
                <FiMessageCircle /> Create Chat
              </button>
            </div>
          </div>
        </div>

        <div className="assignments-section">
          <div className="section-header">
            <h3>Current Chats</h3>
            <div className="section-info">
             
              <p className="session-check-info">Last session check: {new Date(nowTick).toLocaleTimeString()}</p>
              <div className="section-actions">
                <button 
                  className="btn-refresh" 
                  onClick={() => {
                    setNowTick(Date.now());
                    showToast('Session status refreshed', 'info');
                  }}
                  title="Refresh session status"
                >
                   Refresh Sessions
                </button>
                {checkOrphanedChats().length > 0 && (
                  <button 
                    className="btn-cleanup" 
                    onClick={handleCleanupOrphaned}
                    title={`Clean up ${checkOrphanedChats().length} orphaned chats`}
                  >
                    Clean Up Orphaned ({checkOrphanedChats().length})
                  </button>
                )}
              </div>
            </div>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                {activeTab === 'chats' ? (
                  <>
                    <th>Chat ID</th>
                    <th>Student</th>
                    <th>Teacher</th>
                    <th>Course</th>
                    <th>Session Limit</th>
                    <th>Zoom Link</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </>
                ) : (
                  <>
                    <th>Chat ID</th>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </>
                )}
                
              </tr>
            </thead>
            <tbody>
              {activeTab === 'chats' ? (
                chats.length > 0 ? chats
                  .filter(chat => chat.course !== 'Admin') // Filter out Admin chats by checking course field
                  .map(chat => {
                const isOrphaned = !courses.some(course => course.title === chat.course);
                const sessionInfo = chatSessions[chat.id] || { hasActiveOrUpcoming: false, totalBookings: 0 };
                const hasProtectedSessions = sessionInfo.hasActiveOrUpcoming;
                // Chat is protected from filtering if it has active/upcoming sessions (even with 0 session limit)
                // This prevents existing chats that reached 0 from being filtered out
                const isProtected = hasProtectedSessions;
                
                return (
                  <tr key={chat.id} className={`${isOrphaned ? 'orphaned-row' : ''} ${hasProtectedSessions ? 'protected-row' : ''}`}>
                    <td>
                      <span className="chat-id">{chat.id}</span>
                    </td>
                    <td>{chat.studentName}</td>
                    <td>{chat.teacherName}</td>
                    <td>
                      {chat.course}
                      {isOrphaned && <span className="orphaned-badge">Course Deleted</span>}
                    </td>
                    <td>
                      <div className="session-limit-display">
                        <span className={`limit-number ${chat.sessionLimit === 0 ? 'zero-limit' : ''}`}>
                          {chat.sessionLimit}
                        </span>
                        {chat.sessionLimit === 0 && hasProtectedSessions && (
                          <span className="protected-badge" title="Has active/upcoming sessions">
                            🔴 Active Sessions
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`zoom-status ${chat.allowZoomLink ? 'allowed' : 'not-allowed'}`}>
                        {chat.allowZoomLink ? 'Allowed' : ' Not Allowed'}
                      </span>
                      {chat.zoomLink && (
                        <div className="zoom-link-preview">
                          <a href={chat.zoomLink} target="_blank" rel="noopener noreferrer">
                            View Link
                          </a>
                        </div>
                      )}
                    </td>
                    <td>{chat.createdDate}</td>
                    <td>
                      <button className={`status-toggle ${chat.status}`} onClick={()=>toggleChatStatus(chat.id, chat.status)}>
                        {chat.status}
                      </button>
                    </td>
                    <td>
                      <button 
                        className={`btn-icon btn-danger ${isProtected ? 'disabled' : ''}`} 
                        onClick={() => handleUnassign(chat.id)} 
                        title={!isProtected ? "Remove" : "Cannot remove - has active/upcoming sessions"}
                        disabled={isProtected}
                      >
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                );
                }) : (
                  <tr><td colSpan="9">No chats found.</td></tr>
                )
              ) : (
                queries.length > 0 ? queries.map(query => (
                  <tr key={query.id}>
                    <td><span className="chat-id">{query.id}</span></td>
                    <td>
                      {query.userName}
                      {query.userRole && <span className="role-badge">{query.userRole}</span>}
                    </td>
                    <td>{query.userEmail}</td>
                    <td>{query.userRole || 'user'}</td>
                    <td>{query.createdDate}</td>
                    <td>
                      <button 
                        className="btn-icon btn-danger"
                        onClick={() => handleDeleteQuery(query.id)}
                        title="Delete query"
                      >
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="6">No queries found.</td></tr>
                )
              )}
            </tbody>
          </table>
        </div>

        <style jsx>{`
          .form-row { display:grid; grid-template-columns: 1fr 1fr 1fr 1fr auto; gap:24px; align-items:end; }
          .chat-assignment { max-width: 1400px; }
          
          /* Tabs */
          .tabs-container { margin-bottom: 24px; border-bottom: 1px solid #e2e8f0; }
          .tabs { display: flex; gap: 8px; }
          .tab {
            position: relative;
            padding: 12px 24px;
            background: none;
            border: none;
            border-bottom: 3px solid transparent;
            cursor: pointer;
            font-weight: 500;
            color: #64748b;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .tab:hover { color: #334155; }
          .tab.active {
            color: #2563eb;
            border-bottom-color: #2563eb;
          }
          .tab-icon { font-size: 16px; }
          .tab-badge {
            position: absolute;
            top: 4px;
            right: 4px;
            background: #ef4444;
            color: white;
            font-size: 10px;
            font-weight: bold;
            padding: 2px 6px;
            border-radius: 10px;
            line-height: 1;
          }
          
          /* Page Header */
          .page-header { margin-bottom: 32px; }
          .page-header h2 { font-size:32px; font-weight:700; color:#2d3748; margin-bottom:8px; }
          .page-header p { color:#718096; font-size:16px; }
          .assignment-form { margin-bottom:40px; }
          .form-card { background:white; border-radius:16px; padding:32px; box-shadow:0 1px 3px rgba(0,0,0,0.1); border:1px solid #e2e8f0; }
          .form-label { display:flex; align-items:center; gap:8px; margin-bottom:8px; font-weight:500; color:#4a5568; }
          .form-input { width:100%; padding:12px 16px; border:1px solid #e2e8f0; border-radius:8px; font-size:14px; transition:border-color .2s; }
          .form-input:focus { outline:none; border-color:#4299e1; box-shadow:0 0 0 3px rgba(66,153,225,0.1); }
          .form-help { display: block; margin-top: 4px; font-size: 12px; color: #718096; }
          .checkbox-group { display:flex; align-items:center; }
          .checkbox-label { display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:500; color:#4a5568; }
          .checkbox-input { width:18px; height:18px; cursor:pointer; }
          .checkbox-icon { color:#4299e1; }
          .assign-btn { height:fit-content; white-space:nowrap; }
          .section-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; }
          .section-info { display: flex; flex-direction: column; gap: 12px; }
          .info-note { margin: 0; font-size: 14px; color: #718096; font-style: italic; }
          .session-check-info { margin: 0; font-size: 14px; color: #718096; font-style: italic; }
          .section-actions { display: flex; gap: 12px; align-items: center; }
          .btn-refresh { 
          position:relative;
          right:0;
            padding: 8px 16px; 
            border: none; 
            border-radius: 8px; 
            background: #4299e1; 
            color: white; 
            font-size: 14px; 
            cursor: pointer; 
            transition: background .2s; 
            display: flex; 
            align-items: center; 
            gap: 6px;
          }
          .btn-refresh:hover { background: #3182ce; }
          .assignments-section h3 { font-size:24px; font-weight:600; color:#2d3748; margin:0; }
          .btn-cleanup { padding:8px 16px; border:none; border-radius:8px; background:#f56565; color:white; font-size:14px; cursor:pointer; transition:background .2s; }
          .btn-cleanup:hover { background:#e53e3e; }
          .orphaned-row { background:#fef5e7; }
          .orphaned-badge { display:inline-block; margin-left:8px; padding:2px 6px; background:#f56565; color:white; font-size:10px; border-radius:4px; }
          .chat-id { font-family:monospace; font-size:12px; color:#4a5568; background:#f7fafc; padding:2px 6px; border-radius:4px; }
          
          /* Role badge */
          .role-badge {
            display: inline-block;
            background: #e2e8f0;
            color: #4a5568;
            font-size: 11px;
            padding: 2px 6px;
            border-radius: 4px;
            margin-left: 6px;
            text-transform: capitalize;
          }
          .zoom-link-preview { margin-top:4px; }
          .zoom-link-preview a { font-size:11px; color:#4299e1; text-decoration:underline; }
          .zoom-status { padding:4px 12px; border-radius:12px; font-size:12px; font-weight:500; }
          .zoom-status.allowed { background:#c6f6d5; color:#22543d; }
          .zoom-status.not-allowed { background:#fed7d7; color:#742a2a; }
          
          /* Session limit display styling */
          .session-limit-display { display: flex; align-items: center; gap: 8px; }
          .limit-number { font-weight: 600; font-size: 16px; }
          .limit-number.zero-limit { color: #dc2626; }
          .protected-badge { background: #dc2626; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; }
          
          /* Protected row styling */
          .protected-row { background: #fef2f2; border-left: 4px solid #dc2626; }
          .protected-row:hover { background: #fee2e2; }
          
          .status-toggle { padding:6px 16px; border:none; border-radius:20px; font-size:12px; font-weight:500; cursor:pointer; transition:all .2s; text-transform:capitalize; }
          .status-toggle.active { background:#c6f6d5; color:#22543d; }
          .status-toggle.inactive { background:#fed7d7; color:#742a2a; }
          .btn-icon { padding:8px; border:none; border-radius:6px; cursor:pointer; transition:all .2s; background:#f7fafc; color:#4a5568; }
          .btn-icon:hover { background:#e2e8f0; }
          .btn-icon.btn-danger { background:#fed7d7; color:#c53030; }
          .btn-icon.btn-danger:hover { background:#fbb6ce; }
          
          /* Disabled button styling */
          .btn-icon.disabled { opacity: 0.5; cursor: not-allowed; background: #f3f4f6; }
          .btn-icon.disabled:hover { background: #f3f4f6; transform: none; }
          
          .toast-notification { position:fixed; top:20px; right:20px; padding:12px 20px; border-radius:8px; display:flex; align-items:center; gap:10px; box-shadow:0 4px 12px rgba(0,0,0,.15); z-index:1000; animation: slideIn .3s ease-out; }
          .toast-notification.success { background:#c6f6d5; color:#22543d; }
          .toast-notification.error { background:#fed7d7; color:#c53030; }
          .toast-notification.info { background:#bee3f8; color:#2c5282; }
          @keyframes slideIn { from { transform: translateX(100%); opacity:0; } to { transform: translateX(0); opacity:1; } }
          @media (max-width:768px){ .form-row{ grid-template-columns:1fr; gap:16px } }
        `}</style>
      </div>
    </div>
  )
}
