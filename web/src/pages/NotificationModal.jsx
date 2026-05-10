import { X, Bell, Users, BookOpen, MessageCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { subscribeToUserNotifications, markNotificationAsRead } from "../utils/notificationUtils";
import "../styles/NotificationModal.css"

const NotificationModal = ({ onClose }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.email) {
      setLoading(false);
      return;
    }

    // Subscribe to real-time notifications (unread only for read-once behavior)
    const unsubscribe = subscribeToUserNotifications(user.email, (allNotifications) => {
      // Filter for unread notifications only
      const unreadNotifications = allNotifications.filter(n => !n.read);
      setNotifications(unreadNotifications);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      try {
        await markNotificationAsRead(notification.id);
        // The real-time subscription will automatically update the list
        // by filtering out read notifications
      } catch (error) {
        // Error marking notification as read
      }
    }
  };

  const formatTimeAgo = (date) => {
    if (!date) return '';

    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'batch_created':
        return <Users className="w-5 h-5 text-blue-500" />;
      case 'chat_created':
        return <MessageCircle className="w-5 h-5 text-green-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="modal-backdrop">
      {/* Modal Container */}
      <div className="modal-container">
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">Notifications</h2>
          <button
            onClick={onClose}
            className="close-btn"
            aria-label="Close notification modal"
          >
            <X className="w-5 h-5 block" />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {loading ? (
            <div className="notification-loading">
              <p>Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="no-notifications">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No notifications</p>
            </div>
          ) : (
            <div className="notifications-list">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${!notification.read ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-icon">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="notification-content">
                    <h4 className="notification-title">{notification.title}</h4>
                    <p className="notification-message">{notification.message}</p>
                    {notification.batchDetails && (
                      <div className="notification-details">
                        <BookOpen className="w-4 h-4" />
                        <span>{notification.batchDetails.courseName}</span>
                      </div>
                    )}
                    {notification.type === 'chat_created' && (
                      <div className="notification-details">
                        <MessageCircle className="w-4 h-4" />
                        <span>{notification.batchDetails?.courseName}</span>
                        {notification.batchDetails?.allowZoomLink && (
                          <span className="zoom-indicator">• Zoom Enabled</span>
                        )}
                      </div>
                    )}
                    <span className="notification-time">
                      {formatTimeAgo(notification.createdAt)}
                    </span>
                  </div>
                  {!notification.read && (
                    <div className="notification-unread-indicator"></div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;

