"use client"

import { FiHome, FiBook, FiUsers, FiUserCheck, FiMessageCircle, FiLayers, FiCalendar, FiMenu, FiX, FiClock, FiCalendar as FiCalendarIcon, FiCheckSquare } from "react-icons/fi"
import { useIsMobile } from "../hooks/use-mobile"
import { useEffect } from "react"

const menuItems = [
  { id: "dashboard", label: "Dashboard", icon: FiHome },
  { id: "courses", label: "Courses Management", icon: FiBook },
  { id: "users", label: "User Management", icon: FiUsers },
  { id: "teachers", label: "Teacher Management", icon: FiUserCheck },
  { id: "chat-assignment", label: "One-on-One Chat", icon: FiMessageCircle },
  { id: "batch-assignment", label: "Batch Groups", icon: FiLayers },
  { id: "events", label: "Enrollments Management", icon: FiCalendar },
  { id: "booking-requests", label: "Bookings Requests", icon: FiCheckSquare },
  
]

export default function Sidebar({ activeRoute, setActiveRoute, collapsed, setCollapsed }) {
  const isMobile = useIsMobile();
  
  // Close sidebar on mobile when route changes
  useEffect(() => {
    if (isMobile) {
      setCollapsed(true);
    }
  }, [activeRoute, isMobile, setCollapsed]);

  return (
    <>
      {isMobile && (
        <button 
          className="mobile-menu-toggle" 
          onClick={() => setCollapsed(!collapsed)}
          aria-label="Toggle menu"
        >
          {collapsed ? <FiMenu /> : <FiX />}
        </button>
      )}
      <div className={`admin-sidebar ${collapsed ? "collapsed" : ""} ${isMobile ? "mobile" : ""} ${!collapsed && isMobile ? "mobile-open" : ""}`}>
        <div className="sidebar-header" style={{ padding: collapsed ? '10px' : '20px 10px' }}>
          <div className="logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            {!collapsed ? (
              <img src="/logo.png" alt="TheHoneyBee Logo" style={{ height: '40px', objectFit: 'contain' }} />
            ) : (
              <img src="/logo.png" alt="Logo" style={{ height: '24px', objectFit: 'contain', cursor: 'pointer' }} onClick={() => setCollapsed(false)} />
            )}
          </div>
          {!collapsed && (
            <button 
              className="collapse-btn" 
              onClick={() => setCollapsed(true)}
              aria-label="Toggle sidebar"
            >
              <FiX />
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className={`Admin-nav-item ${activeRoute === item.id ? "active" : ""}`}
                onClick={() => {
                  setActiveRoute(item.id);
                }}
                title={collapsed ? item.label : ""}
              >
                <Icon className="Admin-nav-icon" />
                {!collapsed && <span className="Admin-nav-label">{item.label}</span>}
              </button>
            )
          })}
        </nav>
      </div>
    </>
  );
}
