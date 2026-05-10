import React, { useEffect, useMemo, useRef, useState } from 'react';
import '../styles/BookCallModal.css';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { collection, addDoc, query, where, onSnapshot, orderBy, doc, getDoc, setDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { db } from '../services/firebase';
import emailjs from 'emailjs-com';
import { useAuth } from '../context/AuthContext';
import { FiCalendar, FiClock, FiTarget, FiInfo, FiX, FiCheck, FiUser, FiBookOpen } from 'react-icons/fi';

const ADMIN_EMAIL = 'admin@example.com';

// Define default available time slots when no teacher slots are available
const DEFAULT_TIME_SLOTS = [
  '09:00 AM', '10:00 AM', '11:00 AM',
  '02:00 PM', '03:00 PM', '04:00 PM',
  '05:00 PM', '06:00 PM',
];

// Function to generate dynamic meet link
const generateMeetLink = (chatId, date, time) => {
  // Instead of trying to generate meeting codes, redirect to Google Meet's create meeting page
  // This ensures the link will always work
  return 'https://meet.google.com/new';
};

const BookCallModal = ({ isOpen, onClose, onBooking, collectionName = "bookings", privateChatId }) => {
  const [date, setDate] = useState(null);
  const [time, setTime] = useState('');
  const [success, setSuccess] = useState(false);
  const [existingBookings, setExistingBookings] = useState([]);
  const { currentUser, userRole } = useAuth();
  const [chatTeacherDocId, setChatTeacherDocId] = useState(null);
  const [chatCourseId, setChatCourseId] = useState(null);
  const [chatCourseName, setChatCourseName] = useState(null);
  const [teacherSlots, setTeacherSlots] = useState([]);
  const [teacherSlotIds, setTeacherSlotIds] = useState([]);
  const [studentSessionLimits, setStudentSessionLimits] = useState([]);
  const [paymentStatusAtRequest, setPaymentStatusAtRequest] = useState('unknown');
  const [studentNameAtRequest, setStudentNameAtRequest] = useState('');
  const [enrollmentCourseId, setEnrollmentCourseId] = useState(null);
  const [enrollmentIdUsed, setEnrollmentIdUsed] = useState(null);
  const slotUnsubsRef = useRef([]);

  // Debug logging when modal opens
  useEffect(() => {
    // Modal opened
  }, [isOpen, privateChatId, collectionName, currentUser, userRole]);

  // Subscribe to existing bookings for this chat so students see assigned slots
  useEffect(() => {
    if (!isOpen || !privateChatId) return;
    try {
      const q = query(
        collection(db, collectionName),
        where('chatId', '==', privateChatId),
        orderBy('bookedAt', 'desc')
      );
              const unsub = onSnapshot(q, (snap) => {
          const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
          setExistingBookings(items);
      }, (error) => {
        // Error fetching existing bookings
      });
      return () => unsub();
    } catch (error) {
      // Error setting up bookings listener
    }
  }, [isOpen, privateChatId, collectionName]);

  // Fetch chat to resolve teacher doc id and optional course context
  useEffect(() => {
    if (!isOpen || !privateChatId) return;
    (async () => {
      try {
        const chatRef = doc(db, 'chats', privateChatId);
        const snap = await getDoc(chatRef);
        if (snap.exists()) {
          const data = snap.data() || {};
          const teacherIdCandidate = data.teacherDocId || data.teacherId || data.teacherUID || data.teacherUid || null;
          const courseIdCandidate = data.courseId || data.course || null;
          const courseNameCandidate = data.name || data.courseName || data.courseTitle || data.title || null;
          if (teacherIdCandidate) {
            setChatTeacherDocId(String(teacherIdCandidate));
          }
          if (courseIdCandidate) {
            setChatCourseId(String(courseIdCandidate));
          }
          if (courseNameCandidate) {
            setChatCourseName(String(courseNameCandidate));
          }
        }
      } catch {
        /* ignore */
      }
    })();
  }, [isOpen, privateChatId]);

  // Subscribe to teacher doc to get mySlots (list of slot docIds)
  useEffect(() => {
    if (!isOpen || !chatTeacherDocId) return;
    try {
      const teacherRef = doc(db, 'Teacher', chatTeacherDocId);
      const unsub = onSnapshot(teacherRef, (snap) => {
        const data = snap.exists() ? (snap.data() || {}) : {};
        const slots = Array.isArray(data.mySlots) ? data.mySlots.map(String) : [];
        setTeacherSlotIds(slots);
      });
      return () => unsub();
    } catch {
      /* ignore */
    }
  }, [isOpen, chatTeacherDocId]);

  // Subscribe to each slot document listed in mySlots
  useEffect(() => {
    if (!isOpen) return;
    // cleanup previous doc listeners
    slotUnsubsRef.current.forEach((fn) => { try { fn && fn(); } catch { /* ignore */ } });
    slotUnsubsRef.current = [];

    if (!teacherSlotIds || teacherSlotIds.length === 0) {
      setTeacherSlots([]);
      return;
    }
    const acc = [];
    teacherSlotIds.forEach((slotId) => {
      try {
        const ref = doc(db, 'teacherSlots', String(slotId));
        const unsub = onSnapshot(ref, (snap) => {
          if (!snap.exists()) {
            // Remove this slot from local state if deleted
            setTeacherSlots((prev) => prev.filter((s) => s.id !== String(slotId)));
            return;
          }
          const data = { id: snap.id, ...(snap.data() || {}) };
          if (data) {
            // Upsert logic
            const idx = acc.findIndex((s) => s.id === data.id);
            if (idx >= 0) acc[idx] = data; else acc.push(data);
            // Deduplicate by id when updating state
            setTeacherSlots((prev) => {
              const next = [...prev];
              const i = next.findIndex((s) => s.id === data.id);
              if (i >= 0) next[i] = data; else next.push(data);
              return next;
            });
          }
        });
        slotUnsubsRef.current.push(unsub);
      } catch {
        /* ignore */
      }
    });
    return () => {
      slotUnsubsRef.current.forEach((fn) => { try { fn && fn(); } catch { /* ignore */ } });
      slotUnsubsRef.current = [];
    };
  }, [isOpen, teacherSlotIds]);

  // Subscribe to sessionLimits for current student to enforce booking limits
  useEffect(() => {
    if (!isOpen || !currentUser?.uid) return;
    try {
      const q = query(collection(db, 'sessionLimits'), where('studentId', '==', currentUser.uid));
      const unsub = onSnapshot(q, (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        setStudentSessionLimits(items);
      });
      return () => unsub();
    } catch {
      /* ignore */
    }
  }, [isOpen, currentUser]);

  // Determine payment status + student name using enrollments by current user's email/uid
  useEffect(() => {
    const fetchPaymentStatus = async () => {
      try {
        if (!isOpen) return;
        const uid = currentUser?.uid || null;
        const email = currentUser?.email || null;
        if (!uid && !email) return;

        const results = [];
        // Query by studentId
        if (uid) {
          const q1 = query(collection(db, 'enrollments'), where('studentId', '==', uid));
          const snap1 = await getDocs(q1);
          snap1.docs.forEach(d => results.push({ id: d.id, ...(d.data() || {}) }));
        }
        // Query by email/Gmail
        if (email) {
          try {
            const q2 = query(collection(db, 'enrollments'), where('email', '==', email));
            const snap2 = await getDocs(q2);
            snap2.docs.forEach(d => results.push({ id: d.id, ...(d.data() || {}) }));
          } catch {}
          try {
            const q3 = query(collection(db, 'enrollments'), where('Gmail', '==', email));
            const snap3 = await getDocs(q3);
            snap3.docs.forEach(d => results.push({ id: d.id, ...(d.data() || {}) }));
          } catch {}
        }

        // Resolve student name from any enrollment
        const nameFromEnroll = (() => {
          const e = results[0];
          if (!e) return null;
          return e.name || e.studentName || (e.notes && (e.notes.name || e.notes.studentName)) || null;
        })();
        setStudentNameAtRequest(nameFromEnroll || currentUser?.displayName || (currentUser?.email?.split('@')[0]) || 'Student');



        // If chat course is known, prefer course-specific payment status and courseId
        // Step-by-step enrollment matching: 1) Check email 2) Match course name 3) Check paid status
        const matchesCourse = (enr) => {
          // Step 1: Check if this enrollment belongs to the current student (by email)
          const studentEmail = currentUser?.email || '';
          const enrollmentEmail = String(enr.email || enr.customerEmail || '').toLowerCase();
          const isStudentEnrollment = enrollmentEmail === studentEmail.toLowerCase();
          
          if (!isStudentEnrollment) {
            return false;
          }
          
          // Step 2: Check if chat course name matches enrollment course title/name (case insensitive)
          const chatCourseNameLower = String(chatCourseName || '').trim().toLowerCase();
          const enrollmentCourseNameLower = String(enr.courseName || '').trim().toLowerCase();
          const enrollmentCourseTitleLower = String(enr.courseTitle || enr.title || '').trim().toLowerCase();
          
          const courseNameMatches = chatCourseNameLower && (
            enrollmentCourseNameLower === chatCourseNameLower || 
            enrollmentCourseTitleLower === chatCourseNameLower
          );
          
          if (!courseNameMatches) {
            return false;
          }
          
          // Step 3: Check if enrollment is paid
          const paymentStatus = String(enr.paymentStatus || enr.status || '').toLowerCase();
          const isPaid = paymentStatus.includes('paid');
          
          return isPaid;
        };

        let normalized = 'unknown';
        let usedEnrollmentId = null;
        let resolvedCourseId = null;
        
        // Step-by-step enrollment matching - check all enrollments
        let courseMatch = null;
        
        for (let i = 0; i < results.length; i++) {
          if (matchesCourse(results[i])) {
            courseMatch = results[i];
            break;
          }
        }
        if (courseMatch) {
          // Perfect match found - use this enrollment
          const raw = (courseMatch.paymentStatus || courseMatch.status || '').toString().toLowerCase();
          normalized = raw.includes('paid') ? 'paid' : (raw || 'unknown');
          usedEnrollmentId = courseMatch.id;
          resolvedCourseId = courseMatch.courseId || courseMatch.courseIdStr || courseMatch.course || null;
          

        } else {
          // No exact match - mark as not paid instead of using fallback
          
          // Mark as not paid since no exact course match found
          normalized = 'not paid';
          usedEnrollmentId = null;
          resolvedCourseId = null;
        }
        
        // Set the resolved courseId (even if it's empty string, we want to capture it)
        if (resolvedCourseId !== null) {
          setEnrollmentCourseId(String(resolvedCourseId));
          // If chat courseId is missing, fill it from enrollment
          if (!chatCourseId) {
            setChatCourseId(String(resolvedCourseId));
          }
        }
        setEnrollmentIdUsed(usedEnrollmentId);
        setPaymentStatusAtRequest(normalized);
      } catch (err) {
        setPaymentStatusAtRequest('unknown');
        setStudentNameAtRequest(currentUser?.displayName || (currentUser?.email?.split('@')[0]) || 'Student');
      }
    };
    fetchPaymentStatus();
  }, [isOpen, currentUser, chatCourseId, chatCourseName]);

  // Build dynamic available time slots for selected date from teacherSlots
  const slotsToShow = useMemo(() => {
    if (!date) return [];
    const selected = date instanceof Date ? date.toLocaleDateString('en-CA') : null; // YYYY-MM-DD (local)
    if (!selected) return [];

    const matchingSlots = teacherSlots.filter((s) => String(s.date || '') === selected && s.fromTime && s.toTime);
    
    const out = [];
    const now = new Date();
    const isToday = selected === now.toLocaleDateString('en-CA');
    
    matchingSlots.forEach((s) => {
      
      // If it's today, check if the slot has already passed
      if (isToday) {
        // Convert slot end time to 24-hour format for comparison
        const to24 = (timeStr, period) => {
          let [h, m] = timeStr.split(':').map(Number);
          if (period === 'PM' && h !== 12) h += 12;
          if (period === 'AM' && h === 12) h = 0;
          return { h, m };
        };
        
        const { h: endHour, m: endMinute } = to24(s.toTime, s.toPeriod);
        const slotEndTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHour, endMinute, 0, 0);
        
        // If slot has already ended, skip it
        if (now > slotEndTime) {
          return;
        }
      }
      
      // Create a readable time slot label
      const fromTimeFormatted = `${s.fromTime} ${s.fromPeriod}`;
      const toTimeFormatted = `${s.toTime} ${s.toPeriod}`;
      const timeLabel = `${fromTimeFormatted} - ${toTimeFormatted}`;
      
      out.push({ 
        label: timeLabel, 
        slotId: s.id,
        fromTime: s.fromTime,
        fromPeriod: s.fromPeriod,
        toTime: s.toTime,
        toPeriod: s.toPeriod
      });
    });
    
    // Sort by start time for a logical order
    const sorted = out.sort((a, b) => {
      const aStart = `${a.fromTime} ${a.fromPeriod}`;
      const bStart = `${b.fromTime} ${b.fromPeriod}`;
      return aStart.localeCompare(bStart);
    });
    
    return sorted;
  }, [date, teacherSlots]);

  // Generate dynamic meet link
  const meetLink = (() => {
    if (!date || !time) {
      return 'https://meet.google.com/select-date-time';
    }
    return generateMeetLink(privateChatId, date?.toLocaleDateString('en-CA'), time);
  })();

  // Persist student's selected date to Firestore for this chat (lightweight signal)
  useEffect(() => {
    if (!isOpen || !privateChatId || !date) return;
    try {
      const selected = date instanceof Date ? date.toLocaleDateString('en-CA') : null;
      if (!selected) return;
      const ref = doc(db, 'bookingSelections', privateChatId);
      setDoc(ref, {
        chatId: privateChatId,
        selectedDate: selected,
        updatedAt: serverTimestamp(),
        lastSelectedByUid: currentUser?.uid || null,
        lastSelectedByRole: userRole || null,
      }, { merge: true }).catch(() => {});
    } catch {}
  }, [isOpen, privateChatId, date, currentUser, userRole]);

  const handleTimeClick = (slotLabel) => {
    setTime(slotLabel);
  };

  // Helper function to check if a selected time slot is still valid
  const isSlotStillValid = (selectedTime) => {
    if (!selectedTime || !date) return false;
    
    const selectedSlot = slotsToShow.find((s) => s.label === selectedTime);
    if (!selectedSlot) return false;
    
    // If it's not today, the slot is valid
    if (date.toLocaleDateString('en-CA') !== new Date().toLocaleDateString('en-CA')) {
      return true;
    }
    
    // For today, check if the slot has already passed
    const now = new Date();
    const to24 = (timeStr, period) => {
      let [h, m] = timeStr.split(':').map(Number);
      if (period === 'PM' && h !== 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;
      return { h, m };
    };
    
    const { h: endHour, m: endMinute } = to24(selectedSlot.toTime, selectedSlot.toPeriod);
    const slotEndTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHour, endMinute, 0, 0);
    
    return now <= slotEndTime;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date || !time) return;

    // Additional validation: check if the selected slot is still valid
    if (!isSlotStillValid(time)) {
      alert('This time slot has expired. Please select a different time.');
      return;
    }



    // Resolve selected slot id
    const selectedSlot = slotsToShow.find((s) => s.label === time) || null;
    const selectedSlotId = selectedSlot ? selectedSlot.slotId : null;

    // Enforce per-student session limit (if configured)
    if (selectedSlotId) {
      const limitDoc = studentSessionLimits.find((l) => {
        const slotOk = String(l.slotId || '') === String(selectedSlotId);
        const courseOk = chatCourseId ? String(l.courseId || '') === String(chatCourseId) : true;
        return slotOk && courseOk;
      });
      const allowed = limitDoc?.limit;
      if (typeof allowed === 'number') {
        const used = existingBookings.filter((b) => String(b.slotId || '') === String(selectedSlotId)).length;
        if (used >= allowed) {
          alert('You have reached the booking limit for this slot.');
          return;
        }
      }
    }

    const bookingRequest = {
      date: date.toLocaleDateString('en-CA'),
      time: time,
      bookedAt: new Date().toISOString(),
      chatId: privateChatId || null,
      createdByUid: currentUser?.uid || null,
      createdByRole: userRole || null,
      slotId: selectedSlotId || null,
      teacherDocId: chatTeacherDocId || null,
      courseId: chatCourseId || enrollmentCourseId || null,
      courseName: chatCourseName || null,
      status: 'pending', // New field for approval status
      studentName: studentNameAtRequest || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Student',
      studentEmail: currentUser?.email || null,
      paymentStatusAtRequest: paymentStatusAtRequest || 'unknown',
    };
    try {
      const docRef = await addDoc(collection(db, collectionName), bookingRequest);

      if (onBooking) onBooking();
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1000);
    } catch (error) {
      alert('Failed to create booking request. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="bookcall-modal-overlay">
      <div className="bookcall-modal">
        <button className="bookcall-close" onClick={onClose}>
          <FiX size={20} />
        </button>
        
        <div className="booking-modal-header">
          <h2 className="booking-modal-title">
            <FiCalendar size={24} /> 
          </h2>
        <h3> Book a Session</h3>  
        </div>

        <form onSubmit={handleSubmit} className="bookcall-form">
          {/* Date Picker */}
          <div className="booking-date-picker-wrapper">
            <div className="booking-date">
              <label className="booking-form-label">
                <FiCalendar size={16} />
                Select Date
              </label>
              <DatePicker
                selected={date}
                onChange={setDate}
                dateFormat="dd/MM/yyyy"
                minDate={new Date()}
                inline
                required
                className="date-picker-input"
              />
            </div>
          </div>
          
    
          
          {/* Time Slots */}
          <div className="booking-times">
            <label className="booking-form-label">
              <FiClock size={16} />
              Available Time Slots
            </label>
            <div className="booking-times-list">
              {slotsToShow.length === 0 ? (
                <div className="booking-no-slots-message">
                  {date ? (
                    date.toLocaleDateString('en-CA') === new Date().toLocaleDateString('en-CA') 
                      ? 'No available slots for today (all slots have expired)'
                      : 'No available slots for this date'
                  ) : 'Select a date to see available time slots'}
                </div>
              ) : (
                slotsToShow.map((slot) => (
                  <button
                    type="button"
                    key={slot.slotId + '_' + slot.label}
                    className={'booking-time-pill' + (time === slot.label ? ' selected' : '')}
                    onClick={() => handleTimeClick(slot.label)}
                  >
                    <FiClock size={16} className="booking-slot-icon" />
                    <div className="booking-slot-content">
                      <div className="booking-slot-time">
                        {slot.fromTime} {slot.fromPeriod} - {slot.toTime} {slot.toPeriod}
                      </div>
                      <div className="booking-slot-id">
                        Slot #{slot.slotId}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
            
            {/* Additional info for today's slots */}
            {date && date.toLocaleDateString('en-CA') === new Date().toLocaleDateString('en-CA') && (
              <div className="today-slots-info">
                <FiInfo size={14} />
                <span>Showing only future time slots for today</span>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="booking-summary">
            <div className="booking-summary-title">Booking Request Summary</div>
            <div className="booking-summary-row">
              <FiCalendar size={16} />
              <span>{date ? date.toLocaleDateString() : '--/--/----'}</span>
            </div>
            <div className="booking-summary-row">
              <FiClock size={16} />
              <span>{time || '--:--'}</span>
            </div>
            {time && (
              <div className="booking-summary-row">
                <FiTarget size={16} />
                <span>
                  {(() => {
                    const selectedSlot = slotsToShow.find(s => s.label === time);
                    return selectedSlot ? `Slot #${selectedSlot.slotId}` : 'Slot info not available';
                  })()}
                </span>
              </div>
            )}
            <div className="booking-summary-row">
              <FiInfo size={16} />
              <span className="booking-approval-notice">
                Request will be sent to admin for approval
              </span>
            </div>
          </div>

          {success && (
            <div className="booking-success">
              <FiCheck size={16} />
              Booking Request Sent Successfully!
            </div>
          )}

          {/* Actions */}
          <div className="booking-actions">
            <button type="button" className="booking-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="booking-submit"
              disabled={!date || !time || !isSlotStillValid(time)}
            >
              <FiCheck size={16} />
              Send Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookCallModal;
