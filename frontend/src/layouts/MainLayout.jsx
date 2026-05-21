import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import NotificationDropdown from '../components/NotificationDropdown';
import { AuthContext } from '../context/AuthContext';
import { Bell, LogOut, X } from 'lucide-react';
import api from '../services/api';
import './MainLayout.css';

const POLL_MS = 45000;

const getRoleLabel = (role) => {
  switch(role) {
    case 'BGH': return 'Ban Giám Hiệu';
    case 'TO_TRUONG': return 'Tổ trưởng';
    case 'GIAO_VIEN': return 'Giáo viên';
    default: return role;
  }
};

const MainLayout = ({ children }) => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [toasts, setToasts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const markRead = async (noti) => {
    try {
      await api.post(`/notifications/${noti.id}/read`);
    } catch {
      /* ignore */
    }
    setUnreadCount((c) => Math.max(0, c - 1));
    setNotifications((prev) =>
      prev.map((n) => (n.id === noti.id ? { ...n, is_read: true } : n))
    );
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
    } catch {
      /* ignore */
    }
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const onToastClick = async (noti) => {
    await markRead(noti);
    removeToast(noti.id);
    if (noti.action_url && typeof noti.action_url === 'string' && noti.action_url.startsWith('/')) {
      navigate(noti.action_url);
    }
  };

  const onDropdownNotificationClick = async (noti) => {
    if (!noti.is_read) {
      await markRead(noti);
    }
    setShowDropdown(false);
    if (noti.action_url && typeof noti.action_url === 'string' && noti.action_url.startsWith('/')) {
      navigate(noti.action_url);
    }
  };

  const toggleDropdown = () => {
    setShowDropdown((prev) => !prev);
  };

  const pollNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get('/notifications/');
      const list = Array.isArray(res.data) ? res.data : [];
      const unread = list.filter((n) => !n.is_read).length;
      setUnreadCount(unread);
      setNotifications(list);

      const maxId = list.length ? Math.max(...list.map((n) => n.id)) : 0;
      const stored = sessionStorage.getItem('notif_watermark');
      if (stored === null) {
        sessionStorage.setItem('notif_watermark', String(maxId));
        return;
      }
      let wm = parseInt(stored, 10);
      if (Number.isNaN(wm)) wm = 0;

      const fresh = list
        .filter((n) => n.id > wm && !n.is_read)
        .sort((a, b) => a.id - b.id);
      if (fresh.length) {
        setToasts((prev) => {
          const have = new Set(prev.map((p) => p.id));
          const add = fresh.filter((n) => !have.has(n.id));
          return [...prev, ...add].slice(-5);
        });
      }
      sessionStorage.setItem('notif_watermark', String(Math.max(wm, maxId)));
    } catch {
      /* offline / 401 handled by api interceptor */
    }
  }, [user]);

  useEffect(() => {
    pollNotifications();
    const id = setInterval(pollNotifications, POLL_MS);
    return () => clearInterval(id);
  }, [pollNotifications]);

  return (
    <div className="layout-container">
      <Sidebar />
      <div className="layout-main">
        <header className="layout-header">
           <div className="navbar" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0 20px', alignItems: 'center' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                 <h3 style={{ margin: 0 }}>Hệ Thống Kiểm Tra Thể Thức RAG</h3>
                 {user && (
                   <button
                     type="button"
                     className="notif-bell"
                     onClick={toggleDropdown}
                     title="Xem thông báo"
                   >
                     <Bell size={20} aria-hidden />
                     {unreadCount > 0 && <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
                   </button>
                 )}
               </div>
               <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                   <span>Chào, <strong>{user?.sub || 'Khách'}</strong> ({getRoleLabel(user?.role) || 'Giáo viên'})</span>
                   <button 
                     type="button"
                     onClick={handleLogout} 
                     style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                   >
                     <LogOut size={16} /> Đăng xuất
                   </button>
               </div>
           </div>
        </header>
        <main className="layout-content">
          {children}
        </main>
        {/* Notification Dropdown */}
        {showDropdown && (
          <NotificationDropdown
            notifications={notifications}
            unreadCount={unreadCount}
            onClose={() => setShowDropdown(false)}
            onMarkRead={markRead}
            onMarkAllRead={markAllRead}
            onClickNotification={onDropdownNotificationClick}
          />
        )}
        <div className="toast-stack" aria-live="polite">
          {toasts.map((n) => (
            <div key={n.id} className="toast-item">
              <button type="button" className="toast-close" onClick={() => removeToast(n.id)} aria-label="Đóng">
                <X size={16} />
              </button>
              <button type="button" className="toast-body" onClick={() => onToastClick(n)}>
                <strong>{n.title}</strong>
                <div className="toast-msg">{n.message}</div>
                {n.action_url ? <span className="toast-hint">Nhấn để mở</span> : null}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MainLayout;
