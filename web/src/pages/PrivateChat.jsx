import React, { useState, useEffect, useRef } from 'react';
import { Send, MoreVertical, Calendar, Clock, Video, Paperclip, X } from 'lucide-react';
import { db } from '../services/firebase';
import {
    collection,
    addDoc,
    query,
    where,
    onSnapshot,
    orderBy,
    doc,
    getDoc,
    updateDoc,
    arrayUnion,
    serverTimestamp
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import BookCallModal from '../components/BookCallModal';
import FileUploadModal from '../components/FileUploadModal';
import FileViewer from '../components/FileViewer';
import '../styles/PrivateChat.css';
import { FiPlay } from 'react-icons/fi';
import { createChatDocument } from '../utils/chatUtils';
const PrivateChat = ({ activeChat, chatId }) => {
    const { currentUser, userRole } = useAuth();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [showBookModal, setShowBookModal] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showFiles, setShowFiles] = useState(false);
    const [showMySessions, setShowMySessions] = useState(false);
    const [fileCount, setFileCount] = useState(0);
    const [showMenu, setShowMenu] = useState(false);
    const [sessionLimit, setSessionLimit] = useState(null);
    const [allowZoomLink, setAllowZoomLink] = useState(false);
    const [zoomLink, setZoomLink] = useState('');
    const [approvedBookings, setApprovedBookings] = useState([]);
    const [mySessions, setMySessions] = useState([]);
    const [nowTick, setNowTick] = useState(Date.now());
    // Track current chat participants for admin actions
    const [studentId, setStudentId] = useState(null);
    const [teacherId, setTeacherId] = useState(null);
    const [courseName, setCourseName] = useState('');
    const menuRef = useRef(null);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
       const [userNames, setUserNames] = useState({});
    // Ticker to re-evaluate active window without data changes
    useEffect(() => {
        const id = setInterval(() => setNowTick(Date.now()), 30000); // 30s
        return () => clearInterval(id);
    }, []);
    // Helper: check if a booking is active now (current local time within booking date+time window)
    const isBookingActiveNow = (booking) => {
        try {
            const dateStr = String(booking.date || '').trim(); // YYYY-MM-DD
            const timeStr = String(booking.time || '').trim(); // "HH:MM AM - HH:MM PM"
            if (!dateStr || !timeStr.includes('-')) return false;
            const [startStr, endStr] = timeStr.split('-').map(s => s.trim());
            const to24 = (s) => {
                const [t, mer] = s.split(' ');
                let [h, m] = t.split(':').map(Number);
                const merU = (mer || '').toUpperCase();
                if (merU === 'PM' && h !== 12) h += 12;
                if (merU === 'AM' && h === 12) h = 0;
                return { h, m };
            };
            const { h: sh, m: sm } = to24(startStr);
            const { h: eh, m: em } = to24(endStr);
            const [y, mo, d] = dateStr.split('-').map(Number);
            const start = new Date(y, (mo - 1), d, sh, sm, 0, 0);
            const end = new Date(y, (mo - 1), d, eh, em, 0, 0);
            const now = new Date(nowTick);
            return now >= start && now <= end;
        } catch {
            return false;
        }
    };
    // Helper: get session status with more detail
    const getSessionStatus = (booking) => {
        try {
            const dateStr = String(booking.date || '').trim();
            const timeStr = String(booking.time || '').trim();
            if (!dateStr || !timeStr.includes('-')) return { status: 'unknown', label: 'Unknown Status', color: 'inactive' };
            const [startStr, endStr] = timeStr.split('-').map(s => s.trim());
            const to24 = (s) => {
                const [t, mer] = s.split(' ');
                let [h, m] = t.split(':').map(Number);
                const merU = (mer || '').toUpperCase();
                if (merU === 'PM' && h !== 12) h += 12;
                if (merU === 'AM' && h === 12) h = 0;
                return { h, m };
            };
            const { h: sh, m: sm } = to24(startStr);
            const { h: eh, m: em } = to24(endStr);
            const [y, mo, d] = dateStr.split('-').map(Number);
            const start = new Date(y, (mo - 1), d, sh, sm, 0, 0);
            const end = new Date(y, (mo - 1), d, eh, em, 0, 0);
            const now = new Date(nowTick);
            // Check if session is upcoming (not started yet)
            if (now < start) {
                const timeUntilStart = start - now;
                const hoursUntilStart = Math.floor(timeUntilStart / (1000 * 60 * 60));
                const minutesUntilStart = Math.floor((timeUntilStart % (1000 * 60 * 60)) / (1000 * 60));
                if (hoursUntilStart > 0) {
                    return { status: 'upcoming', label: `Starts in ${hoursUntilStart}h ${minutesUntilStart}m`, color: 'upcoming' };
                } else if (minutesUntilStart > 0) {
                    return { status: 'upcoming', label: `Starts in ${minutesUntilStart}m`, color: 'upcoming' };
                } else {
                    return { status: 'upcoming', label: 'Starting soon', color: 'upcoming' };
                }
            }
            // Check if session is active (currently running)
            if (now >= start && now <= end) {
                const timeRemaining = end - now;
                const minutesRemaining = Math.floor(timeRemaining / (1000 * 60));
                if (minutesRemaining <= 0) {
                    return { status: 'ending', label: 'Session Ending', color: 'warning' };
                } else if (minutesRemaining <= 15) {
                    return { status: 'ending-soon', label: `Ending in ${minutesRemaining}m`, color: 'warning' };
                } else {
                    return { status: 'active', label: `Active (${minutesRemaining}m left)`, color: 'active' };
                }
            }
            // Session has ended
            return { status: 'ended', label: 'Session Ended', color: 'inactive' };
        } catch {
            return { status: 'unknown', label: 'Unknown Status', color: 'inactive' };
        }
    };
    // Fetch chat data directly from chats collection
    useEffect(() => {
        if (!chatId) return;
        const fetchChatData = async () => {
            try {
                const chatDoc = await getDoc(doc(db, 'chats', chatId));
                if (chatDoc.exists()) {
                    const chatData = chatDoc.data();
                    setSessionLimit(chatData.sessionLimit !== undefined ? chatData.sessionLimit : 16);
                    setAllowZoomLink(chatData.allowZoomLink || false);
                }
            } catch (error) {
                // Error fetching chat data
            }
        };
        fetchChatData();
    }, [chatId]);
      // Fetch user names (both students and teachers) for message display
    useEffect(() => {
        const fetchUserNames = async () => {
            try {                
                if (!chatId) {
                    return;
                }

                // Get chat participants
                const chatDoc = await getDoc(doc(db, 'chats', chatId));
                if (!chatDoc.exists()) {
                    return;
                }

                const chatData = chatDoc.data();
                const participantIds = chatData.users || [];

                if (participantIds.length === 0) {
                    return;
                }

                const namesCache = {};

                // Fetch names from both Students and Teacher collections
                for (const userId of participantIds) {
                    if (!userId || userId === 'admin') continue;

                  

                    // Try Students collection first
                    try {
                        const studentDoc = await getDoc(doc(db, 'Students', userId));
                        if (studentDoc.exists()) {
                            const studentData = studentDoc.data();
                            const studentName = studentData.name || studentData.Name || 'Unknown Student';
                          
                            
                            // Map by document ID
                            namesCache[userId] = studentName;
                            
                            // Also map by Firebase Auth UID if available
                            if (studentData.uid) {
                                namesCache[studentData.uid] = studentName;
                            }
                            if (studentData.userId) {
                                namesCache[studentData.userId] = studentName;
                            }
                            if (studentData.authId) {
                                namesCache[studentData.authId] = studentName;
                            }
                            continue;
                        }
                    } catch (error) {
                    }

                    // Try Teacher collection
                    try {
                        const teacherDoc = await getDoc(doc(db, 'Teacher', userId));
                        if (teacherDoc.exists()) {
                            const teacherData = teacherDoc.data();
                            const teacherName = teacherData.name || teacherData.Name || 'Unknown Teacher';
                            
                            // Map by document ID
                            namesCache[userId] = teacherName;
                            
                            // Also map by Firebase Auth UID if available
                            if (teacherData.uid) {
                                namesCache[teacherData.uid] = teacherName;
                            }
                            if (teacherData.userId) {
                                namesCache[teacherData.userId] = teacherName;
                            }
                            if (teacherData.authId) {
                                namesCache[teacherData.authId] = teacherName;
                            }
                            continue;
                        }
                    } catch (error) {
                    }

                    // If not found in either collection, try querying by uid field
                    try {
                        // Try Students by uid
                        const studentQuery = query(collection(db, 'Students'), where('uid', '==', userId));
                        const studentSnap = await getDocs(studentQuery);
                        if (!studentSnap.empty) {
                            const studentData = studentSnap.docs[0].data();
                            const studentName = studentData.name || studentData.Name || 'Unknown Student';
                            namesCache[userId] = studentName;
                            continue;
                        }

                        // Try Teacher by uid
                        const teacherQuery = query(collection(db, 'Teacher'), where('uid', '==', userId));
                        const teacherSnap = await getDocs(teacherQuery);
                        if (!teacherSnap.empty) {
                            const teacherData = teacherSnap.docs[0].data();
                            const teacherName = teacherData.name || teacherData.Name || 'Unknown Teacher';
                            namesCache[userId] = teacherName;
                            continue;
                        }
                    } catch (error) {
                    }
                    namesCache[userId] = 'Unknown User';
                }

                setUserNames(namesCache);
            } catch (error) {
            }
        };

        fetchUserNames();
    }, [chatId]);

    // Ticker to re-evaluate active window without data changes
    useEffect(() => {
        const id = setInterval(() => setNowTick(Date.now()), 30000); // 30s
        return () => clearInterval(id);
    }, []);
    // Subscribe to chat document to get zoom link
    useEffect(() => {
        if (!chatId) return;
        const chatRef = doc(db, 'chats', chatId);
        const unsub = onSnapshot(chatRef, (snap) => {
            const data = snap.data() || {};
            const link = typeof data.zoomLink === 'string' ? data.zoomLink : '';
            setZoomLink(link);
            // Capture participants for admin actions
            if (data.studentId) setStudentId(String(data.studentId));
            if (data.teacherId) setTeacherId(String(data.teacherId));
            if (typeof data.name === 'string') setCourseName(data.name);
        });
        return () => unsub();
    }, [chatId]);
    // Subscribe to approved bookings for this chat (no orderBy to avoid index; sort and filter client-side)
    useEffect(() => {
        if (!chatId) return;
        const bookingsRef = collection(db, 'bookings');
        const q = query(
            bookingsRef,
            where('chatId', '==', chatId),
            where('status', '==', 'approved')
        );
        const unsub = onSnapshot(q, (snap) => {
            const bookings = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort newest first
            bookings.sort((a, b) => new Date(b.bookedAt || 0).getTime() - new Date(a.bookedAt || 0).getTime());
            setApprovedBookings(bookings);
        });
        return () => unsub();
    }, [chatId]);
    // NEW: Subscribe to user's own sessions across all chats
    useEffect(() => {
        if (!currentUser?.uid) return;
        const bookingsRef = collection(db, 'bookings');
        // For both students and teachers: show all sessions in this chat
        // Use createdByUid to get all sessions where someone created a booking
        const q = query(
            bookingsRef,
            where('chatId', '==', chatId),
            where('status', '==', 'approved')
        );
        const unsub = onSnapshot(q, (snap) => {
            const allSessions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort by date and time
            allSessions.sort((a, b) => {
                const dateA = new Date(a.date + ' ' + a.time.split('-')[0]);
                const dateB = new Date(b.date + ' ' + b.time.split('-')[0]);
                return dateA - dateB;
            });
            setMySessions(allSessions);
        });
        return () => unsub();
    }, [currentUser?.uid, chatId]);
    // Fetch messages with session linking
    useEffect(() => {
        if (!chatId) return;
        const messagesRef = collection(db, 'chats', chatId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const msgs = querySnapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    timestamp: doc.data().timestamp?.toDate()
                }))
                .filter((msg) => !msg.isPinned); // Filter out pinned messages
            setMessages(msgs);
        });
        return () => unsubscribe();
    }, [chatId]);
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (newMessage.trim() === '') return;
        try {
            const messageData = {
                text: newMessage,
                senderId: currentUser.uid,
                senderName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
                senderRole: userRole || 'student',
                timestamp: serverTimestamp(),
                sessionId: null, // No longer linking to a session
                messageType: 'text',
                readBy: [currentUser.uid],
            };
            await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);
            setNewMessage('');
        } catch (error) {
            // Error sending message
        }
    };
     const renderMessages = () => {
        return messages.map((message) => {
            const isYou = message.senderId === currentUser.uid;
            const dateObj = message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp);
            
            // Get display name with proper resolution
            let displayName = 'You';
            
            if (!isYou) {
                // First try to get name from our cache (by senderId or uid)
                const cachedName = userNames[message.senderId];
                
                if (cachedName && cachedName !== 'Unknown User') {
                    displayName = cachedName;
                } else {
                    // Fallback to message.senderName, but clean it up
                    const senderName = message.senderName || '';
                    
                    // Check if senderName looks like a real name (not an email)
                    if (senderName && !senderName.includes('@') && senderName.length > 1) {
                        displayName = senderName;
                    } else if (senderName.includes('@')) {
                        // If it's an email, try to format it nicely
                        const emailPrefix = senderName.split('@')[0];
                        const formattedName = emailPrefix
                            .replace(/[._]/g, ' ')
                            .split(' ')
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                            .join(' ');
                        displayName = formattedName || 'User';
                    } else {
                        // Final fallback based on role
                        const senderRole = (message.senderRole || '').toLowerCase();
                        displayName = senderRole === 'teacher' ? 'Teacher' : senderRole === 'student' ? 'Student' : 'User';
                    }
                }
            }

            return (
                <div key={message.id} className={`message ${isYou ? 'sent' : 'received'}`}>
                    <div className="message-content">
                        <div className="message-header">
                            <span className="sender-name">{displayName}</span>
                            {message.sessionId && (
                                <span className="session-badge">
                                    Session: {message.sessionId}
                                </span>
                            )}
                        </div>
                        <div className="message-bubble">
                            <p>{message.text}</p>
                            <span className="message-time">
                                {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                </div>
            );
        });
    };
    // CORRECTED: Check if there are any active sessions for this chat
    // This ensures Zoom link is visible even when sessionLimit is 0 but there are active sessions
    const hasActiveSessions = mySessions.length > 0 && mySessions.some(isBookingActiveNow);
    // CORRECTED: Enhanced logic for Zoom link visibility
    // Show Zoom link ONLY if:
    // 1. Zoom link exists AND
    // 2. There are active sessions in this chat
    const shouldShowZoomLink = zoomLink && hasActiveSessions;
    // NEW: Check if user has any active sessions (even if session limit is 0)
    const hasMyActiveSessions = mySessions.some(session => isBookingActiveNow(session));
    // Function to handle booking session when credits are 0
    const handleBookSessionClick = () => {
        if (sessionLimit === 0) {
            // Redirect to class page when trying to book with 0 credits
            // Navigate to classes page
            window.location.href = '/classes';
        } else {
            // Open booking modal normally
            setShowBookModal(true);
        }
    };
    return (
        <div className="batch-broadcast">
            <div className="batch-header">
                <div className="batch-header-info">
                    <div className="batch-avatar">
                        <span>{activeChat ? activeChat.charAt(0) : 'U'}</span>
                    </div>
                    <div className="batch-header-text">
                        <h2>{activeChat || 'Chat'}</h2>
                        {sessionLimit !== null && (
                            <div className="session-limit-info">
                                <Clock size={16} className='clock-zoom-icon' />
                                <span>
                                    {userRole?.toLowerCase() === 'student' ? (
                                        // Student view
                                        sessionLimit === 0 && hasMyActiveSessions
                                            ? "Last Credit Used - Active Session"
                                            : sessionLimit === 0
                                                ? "Out of credits  visit Class page"
                                                : `Session Limit: ${sessionLimit}`
                                    ) : (
                                        // Teacher view
                                        sessionLimit === 0 && hasMyActiveSessions
                                            ? "Student Used Last Credit - Active Session"
                                            : sessionLimit === 0
                                                ? "Student Has No Credits Left"
                                                : `Student Session Limit: ${sessionLimit}`
                                    )}
                                </span>
                                <br></br>
                                {allowZoomLink && (
                                    <div className="zoom-link-indicator">
                                        <Video size={16} className='clock-zoom-icon' />
                                        <span>Zoom links allowed</span>
                                    </div>
                                )}
                                {/* Show user's active sessions (this replaces the duplicate approvedBookings display) */}
                                {hasMyActiveSessions && (
                                    <div className="my-active-sessions-info">
                                        <FiPlay size={16} />
                                        <span>
                                            {mySessions.filter(session => isBookingActiveNow(session)).length} active session(s) in this chat
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <div className="session-btn-dropdown-container" ref={menuRef}>
                    <button
                        className="session-btn-dropdown-toggle"
                        onClick={() => setShowMenu((prev) => !prev)}
                        role='button'
                        tabIndex={0}
                    >
                        <MoreVertical size={23} />
                    </button>
                    {showMenu && (
                        <div className="session-btn-dropdown-menu">
                            {(userRole?.toLowerCase() === 'student') && (
                                <button
                                    className={`session-btn-dropdown-item ${sessionLimit === 0 ? 'disabled' : ''}`}
                                    onClick={handleBookSessionClick}
                                    title={sessionLimit === 0 ? 'No credits left - click to go to class page' : 'Book a new session'}
                                >
                                    Book Session
                                </button>

                            )}
                            <button
                                className="session-btn-dropdown-item"
                                onClick={() => { setShowMySessions(true); setShowMenu(false); }}
                            >
                                Sessions
                                {mySessions.length > 0 && (
                                    <span className="session-count-badge">
                                        {mySessions.length}
                                    </span>
                                )}
                            </button>
                            {(userRole?.toLowerCase() === 'admin') && (
                                <>
                                    <button
                                        className="session-btn-dropdown-item"
                                        onClick={async () => {
                                            try {
                                                if (!studentId) return;
                                                const sid = String(studentId);
                                                const chat = await createChatDocument(sid, 'admin', courseName || 'Admin');
                                                if (chat) {
                                                    const detail = { type: 'private', id: sid, chatId: chat, name: 'Student', courseName: courseName || 'Admin' };
                                                    window.dispatchEvent(new CustomEvent('hb-open-chat', { detail }));
                                                    try { if (typeof window.hbOpenChatCallback === 'function') window.hbOpenChatCallback(detail); } catch { /* noop */ }
                                                    setShowMenu(false);
                                                }
                                            } catch { /* noop */ }
                                        }}
                                    >
                                        Message Student
                                    </button>

                                    <button
                                        className="session-btn-dropdown-item"
                                        onClick={async () => {
                                            try {
                                                if (!teacherId) return;
                                                const tid = String(teacherId);
                                                const chat = await createChatDocument('admin', tid, courseName || 'Admin');
                                                if (chat) {
                                                    const detail = { type: 'private', id: tid, chatId: chat, name: 'Teacher', courseName: courseName || 'Admin' };
                                                    window.dispatchEvent(new CustomEvent('hb-open-chat', { detail }));
                                                    try { if (typeof window.hbOpenChatCallback === 'function') window.hbOpenChatCallback(detail); } catch { /* noop */ }
                                                    setShowMenu(false);
                                                }
                                            } catch { /* noop */ }
                                        }}
                                    >
                                        Message Teacher
                                    </button>
                                </>
                            )}
                            {(userRole?.toLowerCase() === 'teacher' || userRole?.toLowerCase() === 'student') && (
                                <button
                                    className="session-btn-dropdown-item"
                                    onClick={async () => {
                                        try {
                                            const adminChatId = await createChatDocument(currentUser.uid, 'admin', 'Admin');
                                            if (adminChatId) {
                                                // Mark hidden for this user so it won't appear in sidebar
                                                try {
                                                    await updateDoc(doc(db, 'chats', adminChatId), {
                                                        hiddenFor: arrayUnion(currentUser.uid)
                                                    });
                                                } catch { /* noop */ }
                                                // Open in main view via app event
                                                const detail = { type: 'private', id: 'admin', chatId: adminChatId, name: 'Admin', courseName: 'Admin' };
                                                window.dispatchEvent(new CustomEvent('hb-open-chat', { detail }));
                                                try { if (typeof window.hbOpenChatCallback === 'function') window.hbOpenChatCallback(detail); } catch { /* noop */ }
                                                setShowMenu(false);
                                            }
                                        } catch { /* noop */ }
                                    }}
                                >
                                    Message Admin
                                </button>
                            )}
                            <button
                                className="session-btn-dropdown-item"
                                onClick={() => { setShowFiles(true); setShowMenu(false); }}
                            >
                                View Files {fileCount > 0 && <span className="file-count-badge">{fileCount}</span>}
                            </button>

                        </div>
                    )}
                </div>
            </div>
            <div className="batch-messages">
                {/* Show zoom link ONLY during the specific time slot when student has approved booking */}
                {shouldShowZoomLink && (
                    <div
                        className="pinned-zoom-banner"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            background: '#e6fffa',
                            border: '1px solid #99f6e4',
                            color: '#0f766e',
                            padding: '10px 12px',
                            borderRadius: 8,
                            margin: '8px 12px',
                        }}
                    >
                        <Video size={18} />
                        <span style={{ fontWeight: 600 }}>Session Link:</span>
                        <a
                            href={zoomLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#0ea5e9', textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={zoomLink}
                        >
                            {zoomLink}
                        </a>
                        {/* Show session status only when there are active sessions */}
                        {hasActiveSessions && (
                            <span style={{ fontSize: '12px', color: '#059669', marginLeft: 'auto' }}>
                                🟢 Active Session
                            </span>
                        )}
                    </div>
                )}
                {messages.length === 0 ? (
                    <div className="no-messages">No messages yet. Start the conversation!</div>
                ) : (
                    <>
                        {renderMessages()}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>
            <form className="batch-input" onSubmit={handleSendMessage}>
                <div className="batch-input-wrapper">

                    <button type="button" className="batch-attach-btn" onClick={() => setShowUploadModal(true)} title="Upload File">
                        <Paperclip size={18} />
                    </button>

                    <input
                        type="text"
                        placeholder={`Type your message...`}
                        className="batch-text-input"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        ref={inputRef}
                    />
                    <button type="submit" className="batch-send-btn">
                        <Send size={20} />
                    </button>
                </div>
            </form>
            {/* Session Management */}
            {/* Sessions Modal */}
            <BookCallModal isOpen={showBookModal} onClose={() => setShowBookModal(false)} privateChatId={chatId} />

            {/* FIXED: Pass correct props to FileUploadModal */}
            <FileUploadModal
                isOpen={showUploadModal}
                onClose={() => setShowUploadModal(false)}
                privateChatId={chatId}
                courseName={courseName}
                onFileUploaded={() => setShowUploadModal(false)}
            />
            {/* NEW: My Sessions Modal */}
            {showMySessions && (
                <div className="modal-overlay">
                    <div className="modal-content my-sessions-modal">
                        <div className="modal-header">
                            <h3>Sessions - {activeChat || 'Current Chat'}</h3>
                            <button className="modal-close-btn" onClick={() => setShowMySessions(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            {mySessions.length === 0 ? (
                                <div className="no-sessions">
                                    <Calendar size={48} />
                                    <h3>No Sessions Found</h3>
                                    <p>No sessions found for this chat.</p>
                                </div>
                            ) : (
                                <div className="sessions-list">
                                    {mySessions.map((session) => {
                                        const sessionStatus = getSessionStatus(session);
                                        const isActive = isBookingActiveNow(session);
                                        return (
                                            <div key={session.id} className={`session-item ${isActive ? 'active' : ''}`}>
                                                <div className="session-info">
                                                    <div className="session-header">
                                                        <span className="course-name">{session.courseName || 'Unknown Course'}</span>
                                                        <span className={`session-status ${sessionStatus.color}`}>
                                                            {sessionStatus.status === 'active' && <FiPlay size={14} />}
                                                            {sessionStatus.status === 'upcoming' && <Clock size={14} />}
                                                            {sessionStatus.status === 'ended' && <X size={14} />}
                                                            {sessionStatus.label}
                                                        </span>
                                                    </div>
                                                    <div className="session-details">
                                                        <div className="session-date">
                                                            <Calendar size={14} />
                                                            {session.date}
                                                        </div>
                                                        <div className="session-time">
                                                            <Clock size={14} />
                                                            {session.time}
                                                        </div>
                                                    </div>
                                                </div>
                                                {isActive && zoomLink && (
                                                    <div className="session-actions">
                                                        <a
                                                            href={zoomLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="join-session-btn"
                                                        >
                                                            <Video size={16} />
                                                            Join Session
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {showFiles && (
                <div className="modal-overlay">
                    <div className="modal-content file-viewer-modal">
                        <div className="modal-header">
                            <h3>Files - {activeChat}</h3>
                            <button className="modal-close-btn" onClick={() => setShowFiles(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            {/* FIXED: Pass correct props to FileViewer */}
                            <FileViewer
                                privateChatId={chatId}
                                onFileCountUpdate={setFileCount}
                            />
                        </div>
                    </div>
                </div>
            )}
           <style jsx>{`
             .active-session-info {
             display: flex;
             align-items: center;
             gap: 4px;
             font-size: 12px;
             color: #059669;
             margin-top: 2px;
             }
             .active-sessions-info {
             display: flex;
             align-items: center;
             gap: 4px;
             color: #10b981;
             font-size: 12px;
             margin-top: 4px;
             }
             .my-active-sessions-info {
             display: flex;
             align-items: center;
             gap: 4px;
             color: #f59e0b;
             font-size: 12px;
             margin-top: 4px;
             }
             .session-controls {
             padding: 8px 12px;
             background: #f0f9ff;
             border-top: 1px solid #e0f2fe;
             display: flex;
             justify-content: center;
             }
             .end-session-btn {
             background: #dc2626;
             color: white;
             border: none;
             padding: 6px 12px;
             border-radius: 4px;
             font-size: 12px;
             cursor: pointer;
             }
             .session-badge {
             background: #dbeafe;
             color: #1e40af;
             padding: 2px 6px;
             border-radius: 4px;
             font-size: 10px;
             margin-left: 8px;
             }
             .session-count-badge {
             background: #f59e0b;
             color: white;
             padding: 2px 6px;
             border-radius: 4px;
             font-size: 10px;
             margin-left: 8px;
             }
             .sessions-modal, .my-sessions-modal {
             max-width: 600px;
             }
             .sessions-list {
             display: grid;
             gap: 12px;
             }
             .session-item {
             display: flex;
             justify-content: space-between;
             align-items: center;
             padding: 12px;
             border: 1px solid #e5e7eb;
             border-radius: 8px;
             background: white;
             transition: all 0.2s;
             }
             .session-item.active {
             border-color: #10b981;
             background: #f0fdf4;
             }
             .session-info {
             display: flex;
             flex-direction: column;
             gap: 8px;
             flex: 1;
             }
             .session-header {
             display: flex;
             justify-content: space-between;
             align-items: center;
             }
             .course-name {
             font-weight: 600;
             color: #1f2937;
             }
             .session-status {
             display: flex;
             align-items: center;
             gap: 4px;
             padding: 4px 8px;
             border-radius: 6px;
             font-size: 12px;
             font-weight: 500;
             }
             .session-status.active {
             background: #d1fae5;
             color: #065f46;
             }
             .session-status.upcoming {
             background: #dbeafe;
             color: #1e40af;
             }
             .session-status.ended {
             background: #f3f4f6;
             color: #6b7280;
             }
             .session-status.warning {
              background: #fef3c7;
              color: #92400e;
              display: none;
              }
              .session-details {
              display: flex;
              gap: 16px;
              font-size: 14px;
              color: #6b7280;
              }
              .session-date, .session-time, .session-teacher {
              display: flex;
              align-items: center;
              gap: 4px;
              }
              .session-participant {
              display: flex;
              align-items: center;
              gap: 4px;
              }
              .session-actions {
              display: flex;
              gap: 8px;
              }
              .join-session-btn {
              display: flex;
              align-items: center;
              gap: 6px;
              background: #10b981;
              color: white;
              padding: 8px 16px;
              border-radius: 6px;
              text-decoration: none;
              font-size: 14px;
              font-weight: 500;
              transition: all 0.2s;
              }
              .join-session-btn:hover {
              background: #059669;
              transform: translateY(-1px);
              }
              .no-sessions {
              text-align: center;
              padding: 40px 20px;
              color: #6b7280;
              }
              .no-sessions h3 {
              margin: 16px 0 8px;
              color: #374151;
              }
              .session-limit-info {
              display: flex;
              align-items: center;
              gap: 4px;
              font-size: 12px;
              color:rgb(249, 255, 205);
              margin-top: 4px;
              }
              .zoom-link-indicator {
              display: flex;
              align-items: center;
              gap: 4px;
              color:rgb(186, 252, 231);
              font-size: 12px;
              }
              /* Disabled Book Session button styling */
              .session-btn-dropdown-item.disabled {
              opacity: 0.8;
              cursor: pointer;
              background: #fef2f2;
              color: #dc2626;
              border: 1px solid #fecaca;
              }
              .session-btn-dropdown-item.disabled:hover {
              background: #fee2e2;
              transform: translateY(-1px);
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              /* No credits indicator styling */
              .no-credits-indicator {
              color: #dc2626;
              font-weight: 600;
              font-size: 11px;
              }
              .no-credits-message {
              font-size: 12px;
              color: #6b7280;
              margin-top: 4px;
              display: flex;
              align-items: center;
              gap: 4px;
              }
              @media (min-width: 769px) and (max-width: 811px) {
              .session-limit-info {
              width: 280px;
              // background: red;
              }
              .clock-zoom-icon{
              display: none;
              }
              }
              @media (min-width: 372px) and (max-width: 458px) {
              .session-limit-info {
              width: 280px;
              // background: orange;
              }
              .clock-zoom-icon {
              display: none; /* show only on mobile */
              }
              }
              @media (max-width: 391px)  {
              .session-limit-info {
              width: 240px;
              //  background: red;
              }
              .clock-zoom-icon {
              display: none; /* show only on mobile */
              }
              }
              @media (max-width: 372px)  {
              .session-limit-info {
              width: 200px;
              //  background: blue;
              }
              .clock-zoom-icon {
              display: none; /* show only on mobile */
              }
              }
              @media (min-width: 391px) and (max-width:412px)  {
              .session-limit-info {
              width: 250px;
              // background: yellow;
              }
              .clock-zoom-icon {
              display: none; /* show only on mobile */
              }
              }
              `}</style>
        </div>
    );
};
export default PrivateChat;