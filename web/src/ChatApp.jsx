import React, { useState, useEffect, useContext } from 'react';
import { Bell, ArrowLeft, BellIcon, MessageSquare} from "lucide-react";
import { collection, getDocs } from 'firebase/firestore';
import { db } from './services/firebase';
import { useAuth } from './context/AuthContext';
import { subscribeToUserNotifications } from './utils/notificationUtils';

import Sidebar from "./pages/Sidebar";
import WelcomeScreen from './pages/WelcomeScreen';
import PrivateChat from './pages/PrivateChat';
import AnnouncementsView from './pages/AnnouncementsView';
import NotificationModal from "./pages/NotificationModal";
import ProfileSettingsModal from './pages/ProfileSettingsModal';
import BatchBroadcast from "./pages/BatchBroadcast";
import SlotBooking from './pages/SlotBooking';
import "./styles/ChatApp.css"
const ChatApp = () => {
  const { currentUser, userRole, user} = useAuth();

  const [currentView, setCurrentView] = useState('welcome');
  const [activeChat, setActiveChat] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [profileTab, setProfileTab] = useState('Profile');
  const [isMobileView, setIsMobileView] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [users, setUsers] = useState([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [showChatPopup, setShowChatPopup] = useState(false);
  const [showNoMessage, setShowNoMessage] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth <= 768);
      if (window.innerWidth > 768) setShowSidebar(true);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Subscribe to notifications for unread count
  useEffect(() => {
    if (!user?.email) {
      setUnreadNotificationCount(0);
      return;
    }

    const unsubscribe = subscribeToUserNotifications(user.email, (notifications) => {
      const unreadCount = notifications.filter(n => !n.read).length;
      setUnreadNotificationCount(unreadCount);
    });

    return unsubscribe;
  }, [user]);

  // Fetch users from Firestore
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersCollection = collection(db, 'users');
        const userSnapshot = await getDocs(usersCollection);
        const usersList = userSnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        }));
        
        // Filter out current user from the list
        const filteredUsers = currentUser ? 
          usersList.filter(user => user.uid !== currentUser.uid) : 
          usersList;
          
        setUsers(filteredUsers);
      } catch (error) {
        // Error fetching users
      }
    };
    
    fetchUsers();
  }, [currentUser]);

   const handleFabClick = () => {
    setShowChatPopup(true);
  };

  const handleContactAdmin = async () => {
    try {
      const role = userRole?.toLowerCase();
      if (role === 'teacher' || role === 'student') {
        const { createChatDocument } = await import('./utils/chatUtils');
        const adminChatId = await createChatDocument(currentUser.uid, 'admin', 'Admin');
        if (adminChatId) {
          try {
            const { doc, updateDoc, arrayUnion } = await import('firebase/firestore');
            await updateDoc(doc(db, 'chats', adminChatId), {
              hiddenFor: arrayUnion(currentUser.uid)
            });
          } catch { /* noop */ }
          const detail = { type: 'private', id: 'admin', chatId: adminChatId, name: 'Admin', courseName: 'Admin' };
          window.dispatchEvent(new CustomEvent('hb-open-chat', { detail }));
          try { if (typeof window.hbOpenChatCallback === 'function') window.hbOpenChatCallback(detail); } catch { /* noop */ }
          setShowChatPopup(false);
          return;
        }
      }
    } catch { /* noop */ }
  };

 

  return (
    <div className="chat-app">
      {/* Sidebar */}
      <div className={`chat-sidebar ${showSidebar ? '' : 'hidden'} ${isMobileView ? 'mobile' : ''}`}>
        <Sidebar
          currentView={currentView}
          setCurrentView={(view) => {
            setCurrentView(view);
            setActiveChat(null);

          }}
          setActiveChat={(chat) => {
            setActiveChat(chat);
            if (isMobileView) setShowSidebar(false);
          }}
          setProfileTab={setProfileTab}
          setShowProfileSettings={setShowProfileSettings}
          users={users}
        />
      </div>

      {/* Main Content */}
      <main className="chat-main">
        {isMobileView && activeChat && (
          <button
            onClick={() => {
              setShowSidebar(true);
              setActiveChat(null);
            }}
            className="chat-back-btn"
            
          >
            <ArrowLeft size={20} color="black" strokeWidth={2} className='arrowleft'/>

          </button>
        )}
       
      
        {activeChat === null && <WelcomeScreen />}
        {activeChat && activeChat.type === 'batch' && <BatchBroadcast activeChat={activeChat} />}
        {activeChat && activeChat.type === 'private' && <PrivateChat receiverId={activeChat.id} activeChat={activeChat.name} chatId={activeChat.chatId} courseName={activeChat.courseName} />}
        {activeChat && activeChat.type === 'announcement' && <AnnouncementsView />}
        
      </main>

      {/* 🔔 Notification Icon */}
      {!activeChat && !showProfileSettings && (
        <div className="chat-notification" onClick={() => setShowNotifications(true)}>
          <BellIcon />
          {unreadNotificationCount > 0 && (
            <div className="notification-badge">
              {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
            </div>
          )}
        </div>
      )}

      {/* Floating chat action button - only show when no active chat (same as notification icon) */}
      {!activeChat && !showProfileSettings && (
        <button
          type="button"
          className="floating-chat-btn"
          aria-label="New chat"
          title="New chat"
          onClick={handleFabClick}
        >
          <MessageSquare size={26} />
        </button>
      )}

      {/* Chat Popup */}
      {showChatPopup && (
        <div className="modal-overlay">
          <div className="chat-popup">
            <div className="chat-popup-header">
              <h3>Need Help?</h3>
              <button
                className="chat-popup-close"
                onClick={() => setShowChatPopup(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="chat-popup-body">
              {!showNoMessage ? (
                <>
                  <p>Do you need to contact the admin?</p>
                  <div className="chat-popup-buttons">
                    <button
                      className="chat-popup-btn chat-popup-btn-yes"
                      onClick={handleContactAdmin}
                    >
                      Yes
                    </button>
                    <button
                      className="chat-popup-btn chat-popup-btn-no"
                      onClick={() => {
                        setShowNoMessage(true);
                        setTimeout(() => {
                          setShowChatPopup(false);
                          setShowNoMessage(false);
                        }, 2000);
                      }}
                    >
                      No
                    </button>
                  </div>
                </>
              ) : (
                <div className="chat-popup-message">
                  <p>Okay, I'll be here if you need me. 😊</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showNotifications && <NotificationModal onClose={() => setShowNotifications(false)} />}
      {showProfileSettings && (
        <ProfileSettingsModal
          onClose={() => setShowProfileSettings(false)}
          activeTab={profileTab}
          setActiveTab={setProfileTab}
            userRole={userRole} // ✅ Add this
        />
      )}

      <style jsx>{`
      .chat-popup {
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        max-width: 400px;
        width: 90%;
        max-height: 90vh;
        overflow: hidden;
        position: relative;
        animation: slideUp 0.3s ease-out;
      }

      .chat-popup-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 24px 16px;
        border-bottom: 1px solid #e5e7eb;
        background: #f9fafb;
      }

      .chat-popup-header h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #111827;
      }

      .chat-popup-close {
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        border-radius: 6px;
        color: #6b7280;
        transition: all 0.2s ease;
      }

      .chat-popup-close:hover {
        background: #e5e7eb;
        color: #374151;
      }

      .chat-popup-body {
        padding: 24px;
        text-align: center;
      }

      .chat-popup-body p {
        margin: 0 0 24px 0;
        font-size: 16px;
        color: #374151;
        line-height: 1.5;
      }

      .chat-popup-message {
        animation: fadeIn 0.3s ease-in;
      }

      .chat-popup-message p {
        margin: 0;
        font-size: 16px;
        color: #059669;
        font-weight: 500;
      }

      .chat-popup-buttons {
        display: flex;
        gap: 12px;
        justify-content: center;
      }

      .chat-popup-btn {
        padding: 12px 24px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        min-width: 80px;
      }

      .chat-popup-btn-yes {
        background: #3b82f6;
        color: white;
      }

      .chat-popup-btn-yes:hover {
        background: #2563eb;
        transform: translateY(-1px);
      }

      .chat-popup-btn-no {
        background: #f3f4f6;
        color: #374151;
        border: 1px solid #d1d5db;
      }

      .chat-popup-btn-no:hover {
        background: #e5e7eb;
        transform: translateY(-1px);
      }

      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @media (max-width: 768px) {
        .chat-popup {
          max-width: 350px;
          margin: 20px;
        }

        .chat-popup-buttons {
          flex-direction: column;
        }

        .chat-popup-btn {
          width: 100%;
            `}</style>
    </div>
  );
};

export default ChatApp;