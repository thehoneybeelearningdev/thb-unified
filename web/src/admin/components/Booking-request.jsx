"use client"
import { useState, useEffect } from "react"
import { FiCheck, FiX, FiClock, FiUser, FiBookOpen, FiCalendar, FiMail, FiVideo, FiPlay, FiPause, FiTrash2 } from "react-icons/fi"
import { db } from "../../services/firebase"
import { collection, onSnapshot, query, doc, updateDoc, where, getDocs, deleteDoc, arrayRemove, getDoc } from "firebase/firestore"

export default function BookingRequests() {
  const [bookingRequests, setBookingRequests] = useState([])
  const [acceptedRequests, setAcceptedRequests] = useState([])
  const [students, setStudents] = useState([])
  const [teachers, setTeachers] = useState([])
  const [courses, setCourses] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState({ show: false, message: "", type: "" })
  const [activeTab, setActiveTab] = useState('pending') // 'pending' or 'accepted'
  const [nowTick, setNowTick] = useState(Date.now())
  // NEW: Track active sessions across all chats
  const [activeSessions, setActiveSessions] = useState([])
  // NEW: Confirmation dialog state
  const [deleteConfirmation, setDeleteConfirmation] = useState({ show: false, requestId: null, requestType: null, requestInfo: null })

  // Ticker to re-evaluate active sessions without data changes
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
      
      // Helper function to convert 12-hour format to 24-hour
      const to24 = (timeStr) => {
        const trimmed = timeStr.trim();
        // Handle different time formats
        if (trimmed.includes('AM') || trimmed.includes('PM')) {
          // Format: "HH:MM AM" or "HH:MM PM"
          const [time, meridian] = trimmed.split(' ');
          let [hours, minutes] = time.split(':').map(Number);
          
          if (meridian.toUpperCase() === 'PM' && hours !== 12) {
            hours += 12;
          } else if (meridian.toUpperCase() === 'AM' && hours === 12) {
            hours = 0;
          }
          
          return { h: hours, m: minutes };
        } else {
          // Format: "HH:MM" (already 24-hour)
          const [hours, minutes] = trimmed.split(':').map(Number);
          return { h: hours, m: minutes };
        }
      };
      
      const { h: sh, m: sm } = to24(startStr);
      const { h: eh, m: em } = to24(endStr);
      
      // Parse date components
      const [y, mo, d] = dateStr.split('-').map(Number);
      
      // Create Date objects (month is 0-indexed in JavaScript)
      const start = new Date(y, mo - 1, d, sh, sm, 0, 0);
      const end = new Date(y, mo - 1, d, eh, em, 0, 0);
      const now = new Date(nowTick);
      

      
      return now >= start && now <= end;
    } catch (error) {
      return false;
    }
  };

  // NEW: Helper to get session status with more detail
  const getSessionStatus = (booking) => {
    try {
      const dateStr = String(booking.date || '').trim();
      const timeStr = String(booking.time || '').trim();
      if (!dateStr || !timeStr.includes('-')) return { status: 'unknown', label: 'Unknown Status', color: 'inactive' };
      
      const [startStr, endStr] = timeStr.split('-').map(s => s.trim());
      
      // Helper function to convert 12-hour format to 24-hour
      const to24 = (timeStr) => {
        const trimmed = timeStr.trim();
        // Handle different time formats
        if (trimmed.includes('AM') || trimmed.includes('PM')) {
          // Format: "HH:MM AM" or "HH:MM PM"
          const [time, meridian] = trimmed.split(' ');
          let [hours, minutes] = time.split(':').map(Number);
          
          if (meridian.toUpperCase() === 'PM' && hours !== 12) {
            hours += 12;
          } else if (meridian.toUpperCase() === 'AM' && hours === 12) {
            hours = 0;
          }
          
          return { h: hours, m: minutes };
        } else {
          // Format: "HH:MM" (already 24-hour)
          const [hours, minutes] = trimmed.split(':').map(Number);
          return { h: hours, m: minutes };
        }
      };
      
      const { h: sh, m: sm } = to24(startStr);
      const { h: eh, m: em } = to24(endStr);
      
      // Parse date components
      const [y, mo, d] = dateStr.split('-').map(Number);
      
      // Create Date objects (month is 0-indexed in JavaScript)
      const start = new Date(y, mo - 1, d, sh, sm, 0, 0);
      const end = new Date(y, mo - 1, d, eh, em, 0, 0);
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
          return { status: 'ending', label: 'Session Ending', color: 'ending' };
        } else if (minutesRemaining <= 15) {
          return { status: 'ending-soon', label: `Ending in ${minutesRemaining}m`, color: 'ending' };
        } else {
          return { status: 'active', label: `Active (${minutesRemaining}m left)`, color: 'active' };
        }
      }
      
      // Session has ended
      return { status: 'ended', label: 'Session Ended', color: 'inactive' };
    } catch (error) {
      return { status: 'unknown', label: 'Unknown Status', color: 'inactive' };
    }
  };

  // NEW: Helper to get chat session limit info
  const getChatSessionInfo = async (chatId) => {
    try {
      if (!chatId) return { sessionLimit: null, allowZoomLink: false };
      const chatDoc = await getDoc(doc(db, 'chats', chatId));
      if (chatDoc.exists()) {
        const chatData = chatDoc.data();
        return {
          sessionLimit: chatData.sessionLimit || 0,
          allowZoomLink: chatData.allowZoomLink || false
        };
      }
      return { sessionLimit: null, allowZoomLink: false };
    } catch (error) {
      return { sessionLimit: null, allowZoomLink: false };
    }
  };

  // Fetch all data
  useEffect(() => {
    const unsubStudents = onSnapshot(query(collection(db, 'Students')), (snap) => {
      const list = snap.docs.map(d => ({ 
        id: d.id, 
        uid: d.data().uid || d.id, 
        name: d.data().name || 'Unknown', 
        email: d.data().Gmail || d.data().email || '',
        status: d.data().status || 'active' 
      }))
      setStudents(list.filter(s => s.status === 'active'))
    })

    const unsubTeachers = onSnapshot(query(collection(db, 'Teacher')), (snap) => {
      const list = snap.docs.map(d => ({ 
        id: d.id, 
        uid: d.data().uid || d.id, 
        name: d.data().name || 'Unknown', 
        email: d.data().Gmail || d.data().email || '',
        status: d.data().status || 'active' 
      }))
      setTeachers(list.filter(t => t.status === 'active'))
    })

    const unsubCourses = onSnapshot(query(collection(db, 'courses')), (snap) => {
      const list = snap.docs.map(d => ({ 
        id: d.id, 
        name: d.data().name || d.data().courseName || d.data().title || 'Unknown Course',
        status: d.data().status || 'active' 
      }))
      setCourses(list.filter(c => c.status === 'active'))
    })

    const unsubEnrollments = onSnapshot(query(collection(db, 'enrollments')), (snap) => {
      const list = snap.docs.map(d => ({ 
        id: d.id, 
        ...d.data() 
      }))
      setEnrollments(list)
    })

    // Listen to pending booking requests
    const unsubPendingBookings = onSnapshot(
      query(collection(db, 'bookings'), where('status', '==', 'pending')),
      (snap) => {
        const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        // Sort by bookedAt desc client-side
        const normalized = requests.sort((a, b) => {
          const ta = new Date(a.bookedAt || 0).getTime()
          const tb = new Date(b.bookedAt || 0).getTime()
          return tb - ta
        })
        setBookingRequests(normalized)
        setLoading(false)
      },
      (error) => {
        setToast({ show: true, message: 'Failed to load pending booking requests', type: 'error' })
        setLoading(false)
      }
    )

    // Listen to accepted booking requests
    const unsubAcceptedBookings = onSnapshot(
      query(collection(db, 'bookings'), where('status', '==', 'approved')),
      async (snap) => {
        const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        
        // NEW: Fetch chat session info for each request to show session limit context
        const requestsWithChatInfo = await Promise.all(
          requests.map(async (request) => {
            const chatInfo = await getChatSessionInfo(request.chatId);
            return { ...request, chatInfo };
          })
        );
        
        // Sort by approvedAt desc client-side
        const normalized = requestsWithChatInfo.sort((a, b) => {
          const ta = new Date(a.approvedAt || 0).getTime()
          const tb = new Date(b.approvedAt || 0).getTime()
          return tb - ta
        })
        setAcceptedRequests(normalized)
        
        // Track active sessions - only those actually running now
        const active = normalized.filter(isBookingActiveNow);
        setActiveSessions(active);
      },
      (error) => {
        setToast({ show: true, message: 'Failed to load accepted booking requests', type: 'error' })
      }
    )

    return () => {
      unsubStudents()
      unsubTeachers()
      unsubCourses()
      unsubEnrollments()
      unsubPendingBookings()
      unsubAcceptedBookings()
    }
  }, [])

  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000)
  }

  const getStudentInfo = (studentId) => {
    return students.find(s => s.uid === studentId || s.id === studentId) || { name: 'Unknown Student', email: '' }
  }

  const getTeacherInfo = (teacherId) => {
    return teachers.find(t => t.uid === teacherId || t.id === teacherId) || { name: 'Unknown Teacher', email: '' }
  }

  const getCourseInfo = (courseId) => {
    return courses.find(c => c.id === courseId) || { name: 'Unknown Course' }
  }

  const getPaymentStatus = (studentId, courseId, courseName, studentEmail) => {
    const lowerName = String(courseName || '').trim().toLowerCase()
    const enrollment = enrollments.find(e => {
      const matchesUser = (
        String(e.studentId || '').trim() === String(studentId) ||
        String(e.userId || '').trim() === String(studentId) ||
        (studentEmail && (String(e.email || '').toLowerCase() === String(studentEmail).toLowerCase() || String(e.Gmail || '').toLowerCase() === String(studentEmail).toLowerCase()))
      )
      const eCourseId = String(e.courseId || e.courseIdStr || e.course || '').trim()
      const eName1 = String(e.courseName || '').trim().toLowerCase()
      const eName2 = String(e.courseTitle || e.title || '').trim().toLowerCase()
      const matchesCourse = (
        (!!courseId && eCourseId && eCourseId === String(courseId)) ||
        (!!lowerName && (eName1 === lowerName || eName2 === lowerName || eCourseId.toLowerCase() === lowerName))
      )
      return matchesUser && matchesCourse
    })
    if (!enrollment) return 'Not Enrolled'
    const raw = String(enrollment.paymentStatus || enrollment.status || '').toLowerCase()
    return raw.includes('paid') ? 'Paid' : (enrollment.paymentStatus || enrollment.status || 'Unknown')
  }

  const handleApprove = async (requestId) => {
    try {
      // 1) Update booking to approved
      await updateDoc(doc(db, 'bookings', requestId), {
        status: 'approved',
        approvedAt: new Date().toISOString(),
        approvedBy: 'admin'
      })

      // 2) Find the approved request in state to identify teacher/slot/chat
      const req = bookingRequests.find(r => r.id === requestId)
      if (!req) { showToast('Approved, but could not resolve slot to disable', 'info'); return }

      // 2a) Ensure chat has zoom enabled so link is visible, and decrement session limit by 1 (clamped at 0)
      try {
        if (req.chatId) {
          const chatRef = doc(db, 'chats', String(req.chatId))
          const chatSnap = await getDoc(chatRef)
          if (chatSnap.exists()) {
            const cur = Number(chatSnap.data()?.sessionLimit ?? 0)
            const next = Math.max((Number.isFinite(cur) ? cur : 0) - 1, 0)
            await updateDoc(chatRef, { allowZoomLink: true, sessionLimit: next })
          } else {
            await updateDoc(chatRef, { allowZoomLink: true })
          }
        }
      } catch (e) {
        // Failed enabling zoom / decrementing session limit on chat
      }

      // 3) Locate matching teacherSlots doc(s) by teacherDocId + slotId; delete them
      const slotsQ = query(
        collection(db, 'teacherSlots'),
        where('teacherDocId', '==', String(req.teacherDocId || '')),
        where('id', '==', Number(req.slotId))
      )
      const snap = await getDocs(slotsQ)
      for (const d of snap.docs) {
        try {
          await deleteDoc(d.ref)
        } catch (e) {
          // Failed deleting teacherSlot
        }
        // 4) Remove this slot docId from Teacher.mySlots so it stops appearing
        try {
          await updateDoc(doc(db, 'Teacher', String(req.teacherDocId || '')), {
            mySlots: arrayRemove(d.id)
          })
        } catch (e) {
          // Failed updating teacher mySlots
        }
      }

      showToast('Booking approved, slot disabled, session limit reduced', 'success')
    } catch (error) {
      showToast('Failed to approve booking request', 'error')
    }
  }

  const handleReject = async (requestId) => {
    try {
      await updateDoc(doc(db, 'bookings', requestId), {
        status: 'rejected',
        rejectedAt: new Date().toISOString(),
        rejectedBy: 'admin'
      })
      showToast('Booking request rejected', 'success')
    } catch (error) {
      showToast('Failed to reject booking request', 'error')
    }
  }

  // NEW: Handle deletion of booking requests
  const handleDelete = async (requestId, requestType) => {
    try {
      // Delete the booking document
      await deleteDoc(doc(db, 'bookings', requestId))
      
      const action = requestType === 'pending' ? 'pending request' : 'accepted request'
      showToast(`${action} deleted successfully`, 'success')
    } catch (error) {
      showToast('Failed to delete booking request', 'error')
    }
  }

  // NEW: Show delete confirmation dialog
  const showDeleteConfirmation = (requestId, requestType, requestInfo) => {
    setDeleteConfirmation({ show: true, requestId, requestType, requestInfo })
  }

  // NEW: Handle actual deletion after confirmation
  const confirmDelete = async () => {
    try {
      const { requestId, requestType } = deleteConfirmation
      await deleteDoc(doc(db, 'bookings', requestId))
      
      const action = requestType === 'pending' ? 'pending request' : 'accepted request'
      showToast(`${action} deleted successfully`, 'success')
      
      // Close confirmation dialog
      setDeleteConfirmation({ show: false, requestId: null, requestType: null, requestInfo: null })
    } catch (error) {
      showToast('Failed to delete booking request', 'error')
    }
  }

  // NEW: Cancel delete confirmation
  const cancelDelete = () => {
    setDeleteConfirmation({ show: false, requestId: null, requestType: null, requestInfo: null })
  }

  const renderRequestsTable = (requests, type) => {
    if (requests.length === 0) {
      return (
        <div className="no-requests">
          <FiClock size={48} />
          <h3>No {type === 'pending' ? 'Pending' : 'Accepted'} Requests</h3>
          <p>{type === 'pending' ? 'All booking requests have been processed' : 'No accepted requests found'}</p>
        </div>
      )
    }

    return (
      <div className="requests-container">
        {/* NEW: Active Sessions Summary for Accepted tab */}
        {type === 'accepted' && activeSessions.length > 0 && (
          <div className="active-sessions-summary">
            <FiPlay size={20} />
            <span><strong>{activeSessions.length}</strong> active session{activeSessions.length > 1 ? 's' : ''} running now</span>
            {/* NEW: Show session limit context */}
            <div className="session-limit-context">
              {(() => {
                const sessionsWithZeroLimit = activeSessions.filter(session => 
                  session.chatInfo?.sessionLimit === 0
                );
                if (sessionsWithZeroLimit.length > 0) {
                  return (
                    <span className="zero-limit-warning">
                      ⚠️ {sessionsWithZeroLimit.length} session{sessionsWithZeroLimit.length > 1 ? 's' : ''} running with 0 session limit (last credit used)
                    </span>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        )}
        
       
        
        <table className="admin-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Teacher</th>
              <th>Course</th>
              <th>Date & Time</th>
              <th>Payment Status</th>
              <th>{type === 'pending' ? 'Requested At' : 'Approved At'}</th>
              {type === 'accepted' && <th>Session Status</th>}
              {type === 'accepted' && <th>Session Limit</th>}
              {type === 'pending' && <th>Actions</th>}
              {type === 'accepted' && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {requests.map(request => {
              const student = getStudentInfo(request.createdByUid)
              const teacher = getTeacherInfo(request.teacherDocId)
              const course = getCourseInfo(request.courseId)
              const paymentStatusComputed = getPaymentStatus(request.createdByUid, request.courseId, request.courseName, request.studentEmail)
              const paymentStatus = request.paymentStatusAtRequest || paymentStatusComputed
              
              // NEW: Enhanced session status
              const sessionStatus = type === 'accepted' ? getSessionStatus(request) : null;
              
              // NEW: Session limit info
              const sessionLimitInfo = type === 'accepted' ? request.chatInfo : null;
              const isZeroLimitActive = sessionLimitInfo?.sessionLimit === 0 && sessionStatus?.status === 'active';

              const displayStudentName = request.studentName || student.name
              const displayStudentEmail = request.studentEmail || student.email
              const displayCourseName = request.courseName || course.name

              return (
                <tr key={request.id} className={`${sessionStatus?.status === 'active' ? 'active-session' : ''} ${isZeroLimitActive ? 'zero-limit-active' : ''}`}>
                  <td>
                    <div className="student-info">
                      <FiUser />
                      <div>
                        <div className="name">{displayStudentName}</div>
                        <div className="email">{displayStudentEmail}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="teacher-info">
                      <FiUser />
                      <div>
                        <div className="name">{teacher.name}</div>
                        <div className="email">{teacher.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="course-info">
                      <FiBookOpen />
                      <span>{displayCourseName}</span>
                    </div>
                  </td>
                  <td>
                    <div className="datetime-info">
                      <FiCalendar />
                      <div>
                        <div className="date">{request.date}</div>
                        <div className="time">{request.time}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`payment-status ${String(paymentStatus || '').toLowerCase()}`}>
                      {paymentStatus || 'Unknown'}
                    </span>
                  </td>
                  <td>
                    <div className="request-time">
                      {type === 'pending' 
                        ? new Date(request.bookedAt).toLocaleString()
                        : new Date(request.approvedAt).toLocaleString()
                      }
                    </div>
                  </td>
                  {type === 'accepted' && (
                    <td>
                      <div className={`session-status ${sessionStatus?.color || 'inactive'}`}>
                        {sessionStatus?.status === 'active' && <FiPlay className="status-icon" />}
                        {sessionStatus?.status === 'upcoming' && <FiClock className="status-icon" />}
                        {sessionStatus?.status === 'ending' && <FiPause className="status-icon" />}
                        {sessionStatus?.status === 'ending-soon' && <FiClock className="status-icon" />}
                        {sessionStatus?.status === 'ended' && <FiPause className="status-icon" />}
                        <span>{sessionStatus?.label || 'Unknown'}</span>
                      </div>
                    </td>
                  )}
                  {type === 'accepted' && (
                    <td>
                      <div className={`session-limit-display ${isZeroLimitActive ? 'zero-limit' : ''}`}>
                        {sessionLimitInfo ? (
                          <>
                            <span className="limit-number">{sessionLimitInfo.sessionLimit}</span>
                            {isZeroLimitActive && (
                              <span className="zero-limit-badge" title="Student used last credit for this active session">
                                ⚠️ Last Credit
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="limit-unknown">Unknown</span>
                        )}
                      </div>
                    </td>
                  )}
                  {type === 'pending' && (
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="btn-approve" 
                          onClick={() => handleApprove(request.id)}
                          title="Approve request"
                        >
                          <FiCheck />
                        </button>
                        <button 
                          className="btn-reject" 
                          onClick={() => handleReject(request.id)}
                          title="Reject request"
                        >
                          <FiX />
                        </button>
                        <button 
                          className="btn-delete" 
                          onClick={() => showDeleteConfirmation(request.id, 'pending', { studentName: displayStudentName, courseName: displayCourseName, date: request.date, time: request.time })}
                          title="Delete request"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  )}
                  {type === 'accepted' && (
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="btn-delete" 
                          onClick={() => showDeleteConfirmation(request.id, 'accepted', { studentName: displayStudentName, courseName: displayCourseName, date: request.date, time: request.time })}
                          title="Delete accepted request"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="booking-requests">
      <div className="page-header">
        <div>
          <h2>Booking Requests</h2>
          <p>Review and manage student booking requests</p>
         
          
          {/* Upcoming Sessions Counter */}
          {(() => {
            const upcomingSessions = acceptedRequests.filter(req => {
              const status = getSessionStatus(req);
              return status?.status === 'upcoming';
            });
            return upcomingSessions.length > 0 ? (
              <div className="upcoming-sessions-header">
                <FiClock size={16} />
                <span><strong>{upcomingSessions.length}</strong> upcoming session{upcomingSessions.length > 1 ? 's' : ''} scheduled</span>
              </div>
            ) : null;
          })()}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          <FiClock />
          Pending Requests ({bookingRequests.length})
        </button>
        <button 
          className={`tab-button ${activeTab === 'accepted' ? 'active' : ''}`}
          onClick={() => setActiveTab('accepted')}
        >
          <FiCheck />
          Accepted Requests ({acceptedRequests.length})
        </button>
      </div>

      {toast.show && (
        <div className={`toast-notification ${toast.type}`}>
          <FiClock />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmation.show && (
        <div className="delete-confirmation-overlay">
          <div className="delete-confirmation-modal">
            <div className="confirmation-header">
              <FiTrash2 size={24} />
              <h3>Confirm Deletion</h3>
            </div>
            <div className="confirmation-content">
              <p>Are you sure you want to delete this {deleteConfirmation.requestType} request?</p>
              {deleteConfirmation.requestInfo && (
                <div className="request-details">
                  <div><strong>Student:</strong> {deleteConfirmation.requestInfo.studentName}</div>
                  <div><strong>Course:</strong> {deleteConfirmation.requestInfo.courseName}</div>
                  <div><strong>Date:</strong> {deleteConfirmation.requestInfo.date}</div>
                  <div><strong>Time:</strong> {deleteConfirmation.requestInfo.time}</div>
                </div>
              )}
              <p className="warning-text">This action cannot be undone.</p>
            </div>
            <div className="confirmation-actions">
              <button className="btn-cancel" onClick={cancelDelete}>
                Cancel
              </button>
              <button className="btn-confirm-delete" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-state">Loading booking requests...</div>
      ) : (
        <div className="tab-content">
          {activeTab === 'pending' && renderRequestsTable(bookingRequests, 'pending')}
          {activeTab === 'accepted' && renderRequestsTable(acceptedRequests, 'accepted')}
        </div>
      )}

      <style jsx>{`
        .booking-requests { max-width: 1400px; }
        .page-header { margin-bottom: 32px; }
        .page-header h2 { font-size: 32px; font-weight: 700; color: #2d3748; margin-bottom: 8px; }
        .page-header p { color: #718096; font-size: 16px; }
        
        /* NEW: Active sessions header styling */
        .active-sessions-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
          padding: 8px 16px;
          background: linear-gradient(135deg, #c6f6d5, #9ae6b4);
          color: #22543d;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
        }
        
        /* NEW: Active sessions summary styling */
        .active-sessions-summary {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
          padding: 12px 16px;
          background: linear-gradient(135deg, #e6fffa, #b2f5ea);
          color: #0f766e;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          border-left: 4px solid #14b8a6;
          flex-wrap: wrap;
        }
        
        /* NEW: Session limit context styling */
        .session-limit-context {
          margin-left: auto;
          font-size: 12px;
        }
        
        .zero-limit-warning {
          color: #dc2626;
          font-weight: 600;
          background: #fef2f2;
          padding: 4px 8px;
          border-radius: 4px;
          border: 1px solid #fecaca;
        }
        
        /* NEW: Zero limit active session styling */
        .admin-table tr.zero-limit-active {
          background: #fef2f2;
          border-left: 4px solid #dc2626;
        }
        .admin-table tr.zero-limit-active:hover {
          background: #fee2e2;
        }
        
        /* NEW: Session limit display styling */
        .session-limit-display {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
        }
        
        .session-limit-display.zero-limit {
          color: #dc2626;
        }
        
        .limit-number {
          font-size: 16px;
          color: #1f2937;
        }
        
        .zero-limit-badge {
          background: #dc2626;
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
        }
        
        .limit-unknown {
          color: #6b7280;
          font-style: italic;
        }
        
        /* NEW: Upcoming sessions summary styling */
        .upcoming-sessions-summary {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
          padding: 12px 16px;
          background: linear-gradient(135deg, #dbeafe, #90cdf4);
          color: #2b6cb0;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          border-left: 4px solid #3182ce;
        }
        
        /* NEW: Upcoming sessions header styling */
        .upcoming-sessions-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
          padding: 8px 16px;
          background: linear-gradient(135deg, #dbeafe, #90cdf4);
          color: #2b6cb0;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
        }
        
        .tab-navigation { 
          display: flex; 
          gap: 8px; 
          margin-bottom: 24px; 
          border-bottom: 1px solid #e2e8f0; 
        }
        .tab-button { 
          padding: 12px 20px; 
          border: none; 
          background: none; 
          cursor: pointer; 
          display: flex; 
          align-items: center; 
          gap: 8px; 
          font-weight: 500; 
          color: #718096; 
          border-bottom: 2px solid transparent; 
          transition: all 0.2s; 
        }
        .tab-button:hover { color: #4a5568; }
        .tab-button.active { 
          color: #3182ce; 
          border-bottom-color: #3182ce; 
        }
        
        .loading-state, .no-requests { 
          text-align: center; 
          padding: 60px 20px; 
          background: #f7fafc; 
          border-radius: 12px; 
          margin: 20px 0; 
        }
        .no-requests { color: #718096; }
        .no-requests h3 { margin: 16px 0 8px; color: #4a5568; }
        
        .requests-container { margin-top: 20px; }
        .admin-table { 
          width: 100%; 
          border-collapse: collapse; 
          background: white; 
          border-radius: 12px; 
          overflow: hidden; 
          box-shadow: 0 1px 3px rgba(0,0,0,0.1); 
        }
        .admin-table th { 
          background: #f8fafc; 
          padding: 16px; 
          text-align: left; 
          font-weight: 600; 
          color: #4a5568; 
          border-bottom: 1px solid #e2e8f0; 
        }
        .admin-table td { 
          padding: 16px; 
          border-bottom: 1px solid #f1f5f9; 
          border-radius: 8px; 
          vertical-align: top; 
        }
        .admin-table tr:hover { background: #f8fafc; }
        .admin-table tr.active-session { 
          background: #f0fff4; 
          border-left: 4px solid #48bb78; 
        }
        .admin-table tr.active-session:hover { background: #e6fffa; }
        
        .student-info, .teacher-info, .course-info, .datetime-info { 
          display: flex; 
          align-items: center; 
          gap: 8px; 
        }
        .student-info > div, .teacher-info > div, .datetime-info > div { 
          display: flex; 
          flex-direction: column; 
        }
        .name { font-weight: 600; color: #2d3748; }
        .email { font-size: 12px; color: #718096; }
        .date { font-weight: 600; color: #2d3748; }
        .time { font-size: 12px; color: #718096; }
        
        .payment-status { 
          padding: 4px 8px; 
          border-radius: 6px; 
          font-size: 12px; 
          font-weight: 500; 
          text-transform: capitalize; 
        }
        .payment-status.paid { background: #c6f6d5; color: #22543d; }
        .payment-status.unpaid { background: #fed7d7; color: #742a2a; }
        .payment-status.pending { background: #fef5e7; color: #744210; }
        .payment-status.unknown { background: #e2e8f0; color: #4a5568; }
        .payment-status.not-enrolled { background: #fed7d7; color: #742a2a; }
        
        .session-status { 
          display: flex; 
          align-items: center; 
          gap: 6px; 
          padding: 4px 8px; 
          border-radius: 6px; 
          font-size: 12px; 
          font-weight: 500; 
        }
        .session-status.active { 
          background: #c6f6d5; 
          color: #22543d; 
        }
        .session-status.upcoming { 
          background: #dbeafe; 
          color: #1e40af; 
        }
        .session-status.ending { 
          background: #fef5e7; 
          color: #744210; 
        }
        .session-status.inactive { 
          background: #e2e8f0; 
          color: #6b7280; 
        }
        .status-icon { font-size: 14px; }
        
        .request-time { font-size: 12px; color: #718096; }
        
        .action-buttons { 
          display: flex; 
          gap: 8px; 
          align-items: center; 
        }
        .btn-approve, .btn-reject, .btn-delete { 
          padding: 8px; 
          border: none; 
          border-radius: 6px; 
          cursor: pointer; 
          transition: all 0.2s; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          min-width: 32px;
          height: 32px;
        }
        .btn-approve { 
          background: #c6f6d5; 
          color: #22543d; 
        }
        .btn-approve:hover { background: #9ae6b4; }
        .btn-reject { 
          background: #fed7d7; 
          color: #742a2a; 
        }
        .btn-reject:hover { background: #fbb6ce; }
        .btn-delete { 
          background: #fef2f2; 
          color: #dc2626; 
          border: 1px solid #fecaca;
        }
        .btn-delete:hover { 
          background: #fee2e2; 
          border-color: #fca5a5;
          transform: scale(1.05);
        }
        
        .toast-notification { 
          position: fixed; 
          top: 20px; 
          right: 20px; 
          padding: 12px 20px; 
          border-radius: 8px; 
          display: flex; 
          align-items: center; 
          gap: 10px; 
          box-shadow: 0 4px 12px rgba(0,0,0,.15); 
          z-index: 1000; 
          animation: slideIn 0.3s ease-out; 
        }
        .toast-notification.success { background: #c6f6d5; color: #22543d; }
        .toast-notification.error { background: #fed7d7; color: #742a2a; }
        .toast-notification.info { background: #bee3f8; color: #2c5282; }
        @keyframes slideIn { 
          from { transform: translateX(100%); opacity: 0; } 
          to { transform: translateX(0); opacity: 1; } 
        }

        /* NEW: Delete confirmation dialog styles */
        .delete-confirmation-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1001; /* Ensure it's above other content */
        }
        .delete-confirmation-modal {
          background: white;
          border-radius: 12px;
          padding: 30px;
          width: 90%;
          max-width: 450px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
          position: relative;
          text-align: center;
        }
        .confirmation-header {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-bottom: 20px;
          color: #dc2626; /* Red color for delete confirmation */
        }
        .confirmation-header h3 {
          font-size: 20px;
          font-weight: 700;
          color: #dc2626;
        }
        .confirmation-content {
          margin-bottom: 25px;
          text-align: left;
          padding: 0 10px;
        }
        .confirmation-content p {
          font-size: 16px;
          color: #4a5568;
          margin-bottom: 10px;
        }
        .request-details {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 15px;
          margin-top: 10px;
          text-align: left;
        }
        .request-details div {
          margin-bottom: 5px;
          font-size: 14px;
          color: #4a5568;
        }
        .request-details strong {
          color: #2d3748;
          font-weight: 600;
        }
        .warning-text {
          font-size: 14px;
          color: #742a2a;
          font-weight: 500;
          margin-top: 15px;
          text-align: center;
        }
        .confirmation-actions {
          display: flex;
          justify-content: space-around;
          gap: 15px;
        }
        .btn-cancel, .btn-confirm-delete {
          padding: 12px 25px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 600;
          transition: all 0.2s;
          width: 100%;
          max-width: 180px;
        }
        .btn-cancel {
          background: #e2e8f0;
          color: #4a5568;
        }
        .btn-cancel:hover {
          background: #d6d6d6;
        }
        .btn-confirm-delete {
          background: #dc2626;
          color: white;
        }
        .btn-confirm-delete:hover {
          background: #c53030;
        }
      `}</style>
    </div>
  )
}
