import { Search, MessageSquare, BellDot, Users2, User } from 'lucide-react';
import "../styles/Sidebar.css";
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserChats } from '../utils/chatUtils';
import WelcomeScreen from "../pages/WelcomeScreen"
import { db } from '../services/firebase';
import { collection, onSnapshot, query, where, doc, getDoc, getDocs, orderBy, limit as fbLimit, updateDoc, serverTimestamp } from 'firebase/firestore';

const Sidebar = ({ currentView, setCurrentView, setActiveChat, setShowProfileSettings }) => {
    const { currentUser, userRole } = useAuth();
    const [isMobile, setIsMobile] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [chats, setChats] = useState([]);
    const [batches, setBatches] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [courses, setCourses] = useState([]);
    const [myStudentDocId, setMyStudentDocId] = useState(null);
    const [allUsers, setAllUsers] = useState([]);
    const [dmNameByUserId, setDmNameByUserId] = useState({});

    // Simple unread counter state
    const [unreadCounts, setUnreadCounts] = useState({});
    const [batchUnreadCounts, setBatchUnreadCounts] = useState({});
    const [announcementUnreadCount, setAnnouncementUnreadCount] = useState(0); // Add this

    // Loading states
    const [batchesLoading, setBatchesLoading] = useState(true);
    const [chatsLoading, setChatsLoading] = useState(true);

    // Simple function to mark chat as read
    const markChatAsRead = async (chatId) => {
        if (!currentUser?.uid || !chatId) return;

        try {
            const messagesQuery = query(
                collection(db, 'chats', chatId, 'messages'),
                where('senderId', '!=', currentUser.uid)
            );

            const messagesSnapshot = await getDocs(messagesQuery);
            
            const updatePromises = messagesSnapshot.docs.map(messageDoc => {
                const messageData = messageDoc.data();
                const readBy = messageData.readBy || [];
                
                if (!readBy.includes(currentUser.uid)) {
                    return updateDoc(messageDoc.ref, {
                        readBy: [...readBy, currentUser.uid],
                        [`readAt_${currentUser.uid}`]: serverTimestamp()
                    });
                }
                return Promise.resolve();
            });

            await Promise.all(updatePromises);
            
            // Reset local count immediately
            setUnreadCounts(prev => ({ ...prev, [chatId]: 0 }));
        } catch (error) {
          
        }
    };

    // Simple function to mark batch as read
    const markBatchAsRead = async (batchId) => {
        if (!currentUser?.uid || !batchId) return;

        try {
            const messagesQuery = query(
                collection(db, 'batches', batchId, 'messages'),
                where('senderId', '!=', currentUser.uid)
            );

            const messagesSnapshot = await getDocs(messagesQuery);
            
            const updatePromises = messagesSnapshot.docs.map(messageDoc => {
                const messageData = messageDoc.data();
                const readBy = messageData.readBy || [];
                
                if (!readBy.includes(currentUser.uid)) {
                    return updateDoc(messageDoc.ref, {
                        readBy: [...readBy, currentUser.uid],
                        [`readAt_${currentUser.uid}`]: serverTimestamp()
                    });
                }
                return Promise.resolve();
            });

            await Promise.all(updatePromises);
            
            // Reset local count immediately
            setBatchUnreadCounts(prev => ({ ...prev, [batchId]: 0 }));
        } catch (error) {
          
        }
    };

    // Add function to mark announcements as read
    const markAnnouncementsAsRead = async () => {
        if (!currentUser?.uid) return;

        try {
            const announcementsQuery = query(
                collection(db, 'communityAnnouncements'),
                where('senderId', '!=', currentUser.uid)
            );

            const announcementsSnapshot = await getDocs(announcementsQuery);
            
            const updatePromises = announcementsSnapshot.docs.map(announcementDoc => {
                const announcementData = announcementDoc.data();
                const readBy = announcementData.readBy || [];
                
                if (!readBy.includes(currentUser.uid)) {
                    return updateDoc(announcementDoc.ref, {
                        readBy: [...readBy, currentUser.uid],
                        [`readAt_${currentUser.uid}`]: serverTimestamp()
                    });
                }
                return Promise.resolve();
            });

            await Promise.all(updatePromises);
            
            // Reset local count immediately
            setAnnouncementUnreadCount(0);
        } catch (error) {
            
        }
    };

    // Listen to unread messages in private chats
   useEffect(() => {
    if (!currentUser?.uid) return;

    let chatsQuery;
    
    // For admin users, we need to listen to all chats, not just those where admin is in users array
    if (userRole?.toLowerCase() === 'admin') {
        // Admin sees all chats - no filter needed
        chatsQuery = query(collection(db, 'chats'));
    } else {
        // For students and teachers, only chats where they are participants
        chatsQuery = query(
            collection(db, 'chats'),
            where('users', 'array-contains', currentUser.uid)
        );
    }

    const unsubscribe = onSnapshot(chatsQuery, (chatsSnapshot) => {
        const chatIds = chatsSnapshot.docs.map(doc => doc.id);
        
        if (chatIds.length === 0) {
            setUnreadCounts({});
            return;
        }

        const messageUnsubscribers = [];

        chatIds.forEach(chatId => {
            const messagesQuery = query(
                collection(db, 'chats', chatId, 'messages'),
                where('senderId', '!=', currentUser.uid)
            );

            const messageUnsub = onSnapshot(messagesQuery, (messagesSnapshot) => {
                let unreadCount = 0;
                
                messagesSnapshot.docs.forEach(messageDoc => {
                    const messageData = messageDoc.data();
                    const readBy = messageData.readBy || [];
                    
                    if (!readBy.includes(currentUser.uid)) {
                        unreadCount++;
                    }
                });

                setUnreadCounts(prev => ({ ...prev, [chatId]: unreadCount }));
            });

            messageUnsubscribers.push(messageUnsub);
        });

        return () => {
            messageUnsubscribers.forEach(unsub => unsub());
        };
    });

    return () => unsubscribe();
}, [currentUser?.uid, userRole]); // Add userRole as dependency
    // Listen to unread messages in batches
    useEffect(() => {
        if (!currentUser?.uid || batches.length === 0) return;

        const messageUnsubscribers = [];

        batches.forEach(batch => {
            const messagesQuery = query(
                collection(db, 'batches', batch.id, 'messages'),
                where('senderId', '!=', currentUser.uid)
            );

            const messageUnsub = onSnapshot(messagesQuery, (messagesSnapshot) => {
                let unreadCount = 0;
                
                messagesSnapshot.docs.forEach(messageDoc => {
                    const messageData = messageDoc.data();
                    const readBy = messageData.readBy || [];
                    
                    if (!readBy.includes(currentUser.uid)) {
                        unreadCount++;
                    }
                });

                setBatchUnreadCounts(prev => ({ ...prev, [batch.id]: unreadCount }));
            });

            messageUnsubscribers.push(messageUnsub);
        });

        return () => {
            messageUnsubscribers.forEach(unsub => unsub());
        };
    }, [currentUser?.uid, batches]);

    // Add listener for unread announcements
    useEffect(() => {
        if (!currentUser?.uid) return;

        const announcementsQuery = query(
            collection(db, 'communityAnnouncements'),
            where('senderId', '!=', currentUser.uid)
        );

        const unsubscribe = onSnapshot(announcementsQuery, (announcementsSnapshot) => {
            let unreadCount = 0;
            
            announcementsSnapshot.docs.forEach(announcementDoc => {
                const announcementData = announcementDoc.data();
                const readBy = announcementData.readBy || [];
                
                if (!readBy.includes(currentUser.uid)) {
                    unreadCount++;
                }
            });

            setAnnouncementUnreadCount(unreadCount);
        });

        return () => unsubscribe();
    }, [currentUser?.uid]);

    // Effect to fetch all users (Students, Teachers, Admin) for name resolution
    useEffect(() => {
        const fetchAllUsers = async () => {
            try {
                const usersData = [];

                // Fetch Students
                const studentsSnapshot = await getDocs(collection(db, 'Students'));
                studentsSnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    usersData.push({
                        id: doc.id,
                        uid: data.uid || doc.id,
                        name: data.name || data.Name || 'Unknown Student',
                        email: data.Gmail || data.email || '',
                        role: 'student',
                        ...data
                    });
                });
                // Fetch Teachers
                const teachersSnapshot = await getDocs(collection(db, 'Teacher'));
                teachersSnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    usersData.push({
                        id: doc.id,
                        uid: data.uid || doc.id,
                        name: data.name || data.Name || 'Unknown Teacher',
                        email: data.Gmail || data.email || '',
                        role: 'teacher',
                        ...data
                    });
                });
                // Fetch Admin users if they exist
                try {
                    const adminSnapshot = await getDocs(collection(db, 'Admin'));
                    adminSnapshot.docs.forEach(doc => {
                        const data = doc.data();
                        usersData.push({
                            id: doc.id,
                            uid: data.uid || doc.id,
                            name: data.name || data.Name || 'Admin',
                            email: data.Gmail || data.email || '',
                            role: 'admin',
                            ...data
                        });
                    });
                } catch (error) {
                    // Admin collection might not exist, that's okay
                }
                setAllUsers(usersData);
            } catch (error) {
                // Error fetching users
            }
        };
        fetchAllUsers();
    }, []);
    
    // Resolve and cache other participant names for Admin DMs so we don't show raw IDs or "User"
    useEffect(() => {
        if ((userRole || '').toLowerCase() !== 'admin') return;
        // Helper to resolve a user name by trying multiple collections/strategies
        const resolveName = async (userId, chatId) => {
            // 1) Try already loaded users
            let found = allUsers.find(u => u.uid === userId || u.id === userId || (u.email && u.email.toLowerCase() === String(userId).toLowerCase()));
            if (found) return found.name || 'User';
            // 2) Try direct doc lookups by id in Students, Teacher, users
            try { const snap = await getDoc(doc(db, 'Students', userId)); if (snap.exists()) { const d = snap.data(); return d.name || d.Name || 'User'; } } catch { }
            try { const snap = await getDoc(doc(db, 'Teacher', userId)); if (snap.exists()) { const d = snap.data(); return d.name || d.Name || 'User'; } } catch { }
            try { const snap = await getDoc(doc(db, 'users', userId)); if (snap.exists()) { const d = snap.data(); return d.displayName || d.name || 'User'; } } catch { }
            // 3) Try where uid == userId
            try {
                const qs = await getDocs(query(collection(db, 'Students'), where('uid', '==', userId)));
                if (!qs.empty) { const d = qs.docs[0].data(); return d.name || d.Name || 'User'; }
            } catch { }
            try {
                const qs = await getDocs(query(collection(db, 'Teacher'), where('uid', '==', userId)));
                if (!qs.empty) { const d = qs.docs[0].data(); return d.name || d.Name || 'User'; }
            } catch { }
            try {
                const qs = await getDocs(query(collection(db, 'users'), where('uid', '==', userId)));
                if (!qs.empty) { const d = qs.docs[0].data(); return d.displayName || d.name || 'User'; }
            } catch { }
            // 4) Try latest message senderName in this chat as a fallback label
            try {
                if (chatId) {
                    const msgsRef = collection(db, 'chats', chatId, 'messages');
                    const qs = await getDocs(query(msgsRef, orderBy('timestamp', 'desc'), fbLimit(1)));
                    if (!qs.empty) {
                        const m = qs.docs[0].data();
                        if (m && m.senderName) return m.senderName;
                    }
                }
            } catch { }
            // 5) If looks like an email, use prefix
            if (String(userId).includes('@')) {
                const emailName = String(userId).split('@')[0];
                return emailName.charAt(0).toUpperCase() + emailName.slice(1);
            }
            return 'User';
        };
        // Scan current chats for admin DMs and resolve missing names
        const run = async () => {
            const updates = {};
            for (const chat of (chats || [])) {
                // Only direct messages with admin context
                const isAdminDM = (chat.title === 'Admin') || (chat.otherUser && chat.otherUser.displayName === 'Admin');
                if (!isAdminDM) continue;
                const otherUserId = Array.isArray(chat.users)
                    ? chat.users.find(u => u !== currentUser?.uid && u !== 'admin')
                    : chat.otherParticipantId;
                if (!otherUserId) continue;
                if (dmNameByUserId[otherUserId]) continue; // already resolved
                const name = await resolveName(otherUserId, chat.id);
                if (name) updates[otherUserId] = name;
            }
            if (Object.keys(updates).length > 0) {
                setDmNameByUserId(prev => ({ ...prev, ...updates }));
            }
        };
        run();
    }, [userRole, chats, allUsers, currentUser]);
    
    // Helper function to get user display name for admin direct messages only
    const getUserDisplayName = (chat) => {
        // Only apply name resolution for admin viewing direct messages (not batch chats)
        if (userRole?.toLowerCase() === 'admin' && (chat.title === 'Admin' || (chat.otherUser?.displayName === 'Admin'))) {
            // For admin, show the other participant's name (not "Admin") only for direct messages
            const otherUserId = Array.isArray(chat.users)
                ? chat.users.find(u => u !== currentUser?.uid && u !== 'admin')
                : chat.otherParticipantId;
            if (otherUserId) {
                // Prefer resolved cache first
                if (dmNameByUserId[otherUserId]) return dmNameByUserId[otherUserId];
                // Try to find user by uid first
                let foundUser = allUsers.find(user => user.uid === otherUserId);

                // If not found by uid, try by id
                if (!foundUser) {
                    foundUser = allUsers.find(user => user.id === otherUserId);
                }

                // If not found by id, try by email if otherUserId looks like an email
                if (!foundUser && otherUserId.includes('@')) {
                    foundUser = allUsers.find(user =>
                        user.email?.toLowerCase() === otherUserId.toLowerCase()
                    );
                }
                if (foundUser) {
                    return foundUser.name || 'Unknown User';
                }

                // Fallback: if we can't find the user, try to extract name from email
                if (otherUserId.includes('@')) {
                    const emailName = otherUserId.split('@')[0];
                    return emailName.charAt(0).toUpperCase() + emailName.slice(1);
                }

                return 'User';
            }
        }

        // For all other cases (non-admin users, batch chats, etc.), return the original title/name
        return chat.title || chat.otherUser?.displayName || 'Admin';
    };
    
    // Effect to fetch all teachers (normalized fields)
    useEffect(() => {
        const teachersQuery = query(collection(db, 'Teacher'));
        const unsubscribe = onSnapshot(teachersQuery, (snapshot) => {
            const teachersData = snapshot.docs.map(doc => ({
                id: doc.id,
                uid: doc.data().uid || doc.id,
                name: doc.data().name || 'Unknown',
                email: doc.data().Gmail || doc.data().email || '',
                status: doc.data().status || 'active',
                ...doc.data()
            }));
            setTeachers(teachersData);
        });
        return () => unsubscribe();
    }, []);
    
    // Effect to fetch all courses (with fallback for empty collection)
    useEffect(() => {
        const coursesQuery = query(collection(db, 'courses'));
        const unsubscribe = onSnapshot(coursesQuery, (snapshot) => {
            if (snapshot.empty) {
                // Fallback to mock list like admin batch screen so UI shows names
                const mockCoursesData = [
                    { id: 'C001', courseName: 'React Fundamentals', status: 'active' },
                    { id: 'C002', courseName: 'JavaScript Advanced', status: 'active' },
                    { id: 'C003', courseName: 'Python Basics', status: 'active' },
                    { id: 'C004', courseName: 'Web Design', status: 'active' },
                    { id: 'C005', courseName: 'UI/UX', status: 'active' },
                    { id: 'C006', courseName: 'Data Science', status: 'active' }
                ];
                setCourses(mockCoursesData);
            } else {
                const coursesData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    courseName: doc.data().name || doc.data().courseName || '',
                    status: doc.data().status || 'active',
                    ...doc.data()
                })).filter(c => c.status === 'active');
                setCourses(coursesData);
            }
        });
        return () => unsubscribe();
    }, []);
    
    // Effect to fetch batches and resolve names
    useEffect(() => {
        setBatchesLoading(true);
        const batchesQuery = query(collection(db, 'batches'), where('status', '==', 'active'));
        const unsubscribe = onSnapshot(batchesQuery, (snapshot) => {
            const batchesData = snapshot.docs.map(doc => {
                const data = doc.data();
                // Find the teacher's name using the teacherId
                const teacherInfo = teachers.find(t => t.id === data.teacherId);
                let teacherName = teacherInfo?.name || 'Unknown Teacher';
                // Find the course name using the courseId
                const courseInfo = courses.find(c => c.id === data.courseId);
                const courseName = courseInfo?.courseName || courseInfo?.name || '';
                if (userRole === 'student') {
                    teacherName = 'Teacher';
                } else if (userRole === 'teacher' && teacherInfo?.uid !== currentUser?.uid) {
                    teacherName = 'Teacher';
                }
                return {
                    id: doc.id,
                    ...data,
                    teacher: teacherName,
                    students: Array.isArray(data.students) ? data.students : [],
                    studentsCount: Array.isArray(data.students) ? data.students.length : 0,
                    courseName
                };
            });
            // Role-aware filtering: Admin sees all, Teacher sees own, Student sees assigned
            const roleLower = (userRole || '').toLowerCase();
            const myUid = currentUser?.uid;
            const myEmail = currentUser?.email?.toLowerCase();
            const myTeacher = teachers.find(t => {
                const tEmail = t.email ? t.email.toLowerCase() : '';
                return t.uid === myUid || t.id === myUid || (myEmail && tEmail === myEmail);
            });
            const visibleBatches = batchesData.filter(batch => {
                if (roleLower === 'admin') return true;
                if (roleLower === 'teacher') {
                    // Normalize possible identifiers for teacher matching
                    const teacherCandidates = [
                        batch.teacherId,
                        batch.teacherUid,
                        batch.teacherEmail ? batch.teacherEmail.toLowerCase() : null
                    ].filter(Boolean);
                    // Direct match against current user's identifiers
                    const directMatch = (
                        teacherCandidates.includes(myTeacher?.id) ||
                        teacherCandidates.includes(myTeacher?.uid) ||
                        (myEmail && teacherCandidates.includes(myEmail)) ||
                        (myUid && teacherCandidates.includes(myUid))
                    );
                    if (directMatch) return true;
                    // Fallback: resolve by teacherId -> Teacher collection email comparison
                    if (batch.teacherId) {
                        const matchingTeacher = teachers.find(t => t.id === batch.teacherId);
                        if (matchingTeacher) {
                            const tEmail = matchingTeacher.email ? matchingTeacher.email.toLowerCase() : '';
                            if (myEmail && tEmail === myEmail) return true;
                        }
                    }
                    return false;
                }
                if (roleLower === 'student') {
                    // Normalize assigned entries (supports strings or objects with uid/email/id/Gmail)
                    const assigned = Array.isArray(batch.students) ? batch.students : [];
                    const normalizedAssigned = assigned.map((entry) => {
                        if (typeof entry === 'string') return entry.toLowerCase();
                        if (!entry || typeof entry !== 'object') return '';
                        return (
                            entry.email?.toLowerCase() ||
                            entry.Gmail?.toLowerCase() ||
                            entry.uid ||
                            (typeof entry.id === 'string' ? entry.id.toLowerCase() : entry.id) ||
                            ''
                        );
                    }).filter(Boolean);
                    const myStudentIdLower = myStudentDocId ? myStudentDocId.toLowerCase() : null;
                    // Check if current user is assigned to this batch
                    const isAssigned = (
                        (myEmail && normalizedAssigned.includes(myEmail)) ||
                        (myUid && normalizedAssigned.includes(myUid)) ||
                        (myStudentIdLower && normalizedAssigned.includes(myStudentIdLower))
                    );
                    // Additional check: if myStudentDocId exists, also check if it matches any student ID directly
                    // This handles the case where batch.students contains document IDs
                    if (!isAssigned && myStudentDocId) {
                        const directMatch = assigned.some(studentId =>
                            typeof studentId === 'string' && studentId === myStudentDocId
                        );
                        if (directMatch) return true;
                    }
                    return isAssigned;
                }
                return false;
            });
            setBatches(visibleBatches);
            setBatchesLoading(false);
        });
        return () => unsubscribe();
    }, [teachers, courses, currentUser, userRole, myStudentDocId]); // Rerun when deps change
    
    // Resolve current user's Students doc id to support batches storing doc ids
    useEffect(() => {
        const resolveStudentDocId = async () => {
            try {
                const lowerEmail = currentUser?.email?.toLowerCase();
                let resolvedId = null;
                if (lowerEmail) {
                    // First try: email as document ID (legacy approach)
                    const ref = doc(db, 'Students', lowerEmail);
                    const snap = await getDoc(ref);
                    if (snap.exists()) {
                        resolvedId = snap.id;
                    }
                }
                if (!resolvedId && currentUser?.uid) {
                    // Second try: find by uid field (admin-created students)
                    const q = query(collection(db, 'Students'), where('uid', '==', currentUser.uid));
                    const qs = await getDocs(q);
                    if (!qs.empty) {
                        resolvedId = qs.docs[0].id;
                    }
                }
                if (!resolvedId && lowerEmail) {
                    // Third try: find by Gmail field (landing page students)
                    const q = query(collection(db, 'Students'), where('Gmail', '==', lowerEmail));
                    const qs = await getDocs(q);
                    if (!qs.empty) {
                        resolvedId = qs.docs[0].id;
                    }
                }
                if (!resolvedId && lowerEmail) {
                    // Fourth try: find by email field (fallback)
                    const q = query(collection(db, 'Students'), where('email', '==', lowerEmail));
                    const qs = await getDocs(q);
                    if (!qs.empty) {
                        resolvedId = qs.docs[0].id;
                    }
                }
                setMyStudentDocId(resolvedId);
            } catch (error) {
                setMyStudentDocId(null);
            }
        };
        if (currentUser) {
            resolveStudentDocId();
        } else {
            setMyStudentDocId(null);
        }
    }, [currentUser]);
    
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);
    
    // Listen for programmatic open-chat events (e.g., Message Admin)
    useEffect(() => {
        const handler = (e) => {
            const d = e?.detail || {};
            if (d?.type === 'private' && d?.chatId) {
                setCurrentView && setCurrentView('private-chat');
                setActiveChat && setActiveChat({
                    type: 'private',
                    id: d.id,
                    chatId: d.chatId,
                    name: d.name || 'Admin',
                    courseName: d.courseName || ''
                });
            }
        };
        window.addEventListener('hb-open-chat', handler);
        return () => window.removeEventListener('hb-open-chat', handler);
    }, [setActiveChat, setCurrentView]);
    
    // Provide a direct callback as a fallback to ensure opening works even if events are missed
    useEffect(() => {
        const cb = (d) => {
            if (d?.type === 'private' && d?.chatId) {
                setCurrentView && setCurrentView('private-chat');
                setActiveChat && setActiveChat({
                    type: 'private',
                    id: d.id,
                    chatId: d.chatId,
                    name: d.name || 'Admin',
                    courseName: d.courseName || ''
                });
            }
        };
        try { window.hbOpenChatCallback = cb; } catch { /* noop */ }
        return () => {
            try { if (window.hbOpenChatCallback === cb) window.hbOpenChatCallback = undefined; } catch { /* noop */ }
        };
    }, [setActiveChat, setCurrentView]);

    // Subscribe to user chats to get unread message counts
    useEffect(() => {
        if (!currentUser) return;

        setChatsLoading(true);
        const unsubscribe = getUserChats(currentUser.uid, (userChats) => {
            setChats(userChats);
            setChatsLoading(false);
        }, currentUser.email || currentUser.Gmail || '');

        return () => unsubscribe && unsubscribe();
    }, [currentUser]);

    // Get assigned private chats (only show chats created through admin assignment)
    const assignedChats = chats.filter(chat =>
        (chat.type === 'assigned_private' && chat.isAssigned === true && (chat.visibleUsers || chat.users)?.includes(currentUser?.uid))
        || (!chat.type && Array.isArray(chat.users) && chat.users.includes(currentUser?.uid))
    ) || [];

    const filteredAssignedChats = assignedChats.filter(chat => {
        const displayName = getUserDisplayName(chat);
        return displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (chat.courseName || chat.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    }) || [];
    
    // Get group chats for the current user
    const groupChats = chats.filter(chat =>
        chat.type === 'group' && Array.isArray(chat.users) && chat.users.includes(currentUser?.uid)
    ) || [];

    const filteredGroupChats = groupChats.filter(chat =>
        (chat.groupName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (chat.courseName || '').toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];
    
    // Handle batch click - mark as read when opening
    const handleBatchClick = (batch) => {
        // Mark batch as read when user opens it
        markBatchAsRead(batch.id);
        
        setActiveChat({
            type: 'batch',
            id: batch.id,
            name: batch.batchName,
            students: batch.studentsCount,
            teacher: batch.teacher,
            subject: batch.courseName || batch.course || ''
        });
    };

    // Handle private chat click - mark as read when opening
    const handlePrivateChatClick = (chat) => {
        const receiverId = chat.otherParticipantId || (Array.isArray(chat.users) ? chat.users.find(u => u !== currentUser?.uid && u !== 'admin') : undefined);
        const displayName = getUserDisplayName(chat);
        
        // Mark chat as read when user opens it
        if (chat.id) {
            markChatAsRead(chat.id);
        }
        
        if (receiverId) {
            setActiveChat({
                type: 'private',
                name: displayName,
                id: receiverId,
                chatId: chat.id,
                courseName: chat.courseName || chat.name,
                isAssigned: true
            });
        }
    };

    // Handle group chat click - mark as read when opening
    const handleGroupChatClick = (chat) => {
        // Mark chat as read when user opens it
        if (chat.id) {
            markChatAsRead(chat.id);
        }
        
        setActiveChat({
            type: 'group',
            name: chat.groupName || 'Group Chat',
            id: chat.id,
            courseName: chat.courseName,
            otherUsers: chat.otherUsers
        });
    };

    // Handle announcements click - mark as read when opening
    const handleAnnouncementsClick = () => {
        // Mark announcements as read when user opens them
        markAnnouncementsAsRead();
        
        setActiveChat({ 
            type: 'announcement', 
            name: 'Community Announcements', 
            id: 'community' 
        });
    };
    
    // Loading Component
    const LoadingSpinner = () => (
        <div className="loading-container">
            <p className="loading-text">Loading...</p>
        </div>
    );
    
    const LeftNavBar = () => (
        <div className="left-nav-icons">
            <div
                className={`nav-icon ${currentView === 'batch-broadcasts' ? 'active' : ''}`}
                onClick={() => setCurrentView('batch-broadcasts')}
            >
                <MessageSquare />
                <span className="tooltip">Batch</span>
            </div>
            <div
                className={`nav-icon ${currentView === 'private-chat' ? 'active' : ''}`}
                onClick={() => setCurrentView('private-chat')}
            >
                <BellDot />
                <span className="tooltip">Private</span>
            </div>
            <div
                className={`nav-icon ${currentView === 'announcements' ? 'active' : ''}`}
                onClick={() => setCurrentView('announcements')}
            >
                <Users2 />
                <span className="tooltip">Communities</span>
                
            </div>
            <div
                className="nav-icon"
                onClick={() => setShowProfileSettings(true)}
            >
                <User />
                <span className="tooltip">Profile</span>
            </div>
        </div>
    );
    
    const BottomNav = () => (
        <div className="chatapp-mobile-bottom-nav">
            <div className={`chatapp-nav-item ${currentView === 'batch-broadcasts' ? 'active' : ''}`} onClick={() => setCurrentView('batch-broadcasts')}>
                <MessageSquare />
                <span>Batch</span>
            </div>
            <div className={`chatapp-nav-item ${currentView === 'private-chat' ? 'active' : ''}`} onClick={() => setCurrentView('private-chat')}>
                <BellDot />
                <span>Private</span>
            </div>
            <div className={`chatapp-nav-item ${currentView === 'announcements' ? 'active' : ''}`} onClick={() => setCurrentView('announcements')}>
                <Users2 />
                <span>Communities</span>
               
            </div>
            <div className={`chatapp-nav-item ${currentView === 'profile' ? 'active' : ''}`} onClick={() => {
                setCurrentView('profile');
                setShowProfileSettings(true);
            }}>
                <User />
                <span>Profile</span>
            </div>
        </div>
    );
    
    const Header = () => (
        <div className="sidebar-user-info">
            <div className="sidebar-user-header">
                <h1 className="sidebar-title">HoneyBee Learning</h1>
            </div>
        </div>
    );
    
    return (
        <div className="chat-layout">
            {/* Only for Desktop */}
            {!isMobile && <LeftNavBar />}
            <div className={`sidebar ${isMobile ? 'mobile-sidebar' : ''}`}>
                <Header />
                <div className="sidebar-search">
                    <div className="search-container">
                        <Search className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search chats..."
                            className="search-input"
                            value={searchTerm}
                            onChange={(ev) => setSearchTerm(ev.target.value)}
                        />
                    </div>
                    {isMobile && currentView == "welcome" && <WelcomeScreen />}
                </div>
                
                {/* Chat list based on view */}
                <div className="sidebar-chat-list">
                    {currentView === 'batch-broadcasts' && (
                        <>
                            {batchesLoading ? (
                                <LoadingSpinner />
                            ) : batches.length === 0 ? (
                                <div className="empty-state">No batches assigned</div>
                            ) : (
                                batches.map((batch) => {
                                    const unreadCount = batchUnreadCounts[batch.id] || 0;
                                    return (
                                        <div
                                            key={batch.id}
                                            className="chat-item"
                                            onClick={() => handleBatchClick(batch)}
                                        >
                                            <div>
                                                <h3 className="chat-title">{batch.batchName}</h3>
                                                <p className="chat-subtitle">{batch.studentsCount} Students{batch.courseName ? ` • ${batch.courseName}` : ''}</p>
                                            </div>
                                            {unreadCount > 0 && (
                                                <div className="chat-badge">{unreadCount}</div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </>
                    )}
                    
                    {currentView === 'private-chat' && (
                        <>
                            {chatsLoading ? (
                                <LoadingSpinner />
                            ) : (
                                <>
                                    {/* Display group chats first */}
                                    {filteredGroupChats.map(chat => {
                                        const unreadCount = unreadCounts[chat.id] || 0;
                                        return (
                                            <div
                                                key={chat.id}
                                                className="chat-item group-chat"
                                                onClick={() => handleGroupChatClick(chat)}
                                            >
                                                <div className="chat-user">
                                                    <div>
                                                        <h3 className="chat-title">{chat.groupName || 'Group Chat'}</h3>
                                                        <p className="chat-subtitle">{chat.courseName || 'Course'} • {chat.otherUsers?.length || 0} participants</p>
                                                    </div>
                                                </div>
                                                {unreadCount > 0 && (
                                                    <div className="chat-badge">{unreadCount}</div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* Display assigned chats with proper name resolution for admin */}
                                    {filteredAssignedChats.map(chat => {
                                        const displayName = getUserDisplayName(chat);
                                        const unreadCount = unreadCounts[chat.id] || 0;

                                        return (
                                            <div
                                                key={chat.id}
                                                className="chat-item assigned-chat"
                                                onClick={() => handlePrivateChatClick(chat)}
                                            >
                                                <div className="chat-user">
                                                    <div>
                                                        <h3 className="chat-title">{displayName}</h3>
                                                        <p className="chat-subtitle">{(chat.courseName || chat.name || 'Course')}</p>
                                                    </div>
                                                </div>
                                                {unreadCount > 0 && (
                                                    <div className="chat-badge">{unreadCount}</div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    
                                    {filteredGroupChats.length === 0 && filteredAssignedChats.length === 0 && (
                                        <div className="empty-state">No chats found</div>
                                    )}
                                </>
                            )}
                        </>
                    )}
                    
                    {currentView === 'announcements' && (
                        <div className="chat-item" onClick={handleAnnouncementsClick}>
                            <div>
                                <h3 className="chat-title">Community Announcements</h3>
                            </div>
                            {announcementUnreadCount > 0 && (
                                <div className="chat-badge">{announcementUnreadCount}</div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            {/* Only for Mobile */}
            {isMobile && <BottomNav />}
        </div>
    );
};

export default Sidebar;