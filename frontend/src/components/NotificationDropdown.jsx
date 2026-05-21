import React from 'react';
import { X, CheckCheck, Bell, ExternalLink } from 'lucide-react';
import './NotificationDropdown.css';

const NotificationDropdown = ({ notifications, unreadCount, onClose, onMarkRead, onMarkAllRead, onClickNotification }) => {
  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Vừa xong';
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ngày trước`;
    return d.toLocaleDateString('vi-VN');
  };

  return (
    <div className="notif-dropdown-overlay" onClick={onClose}>
      <div className="notif-dropdown" onClick={(e) => e.stopPropagation()}>
        <div className="notif-dropdown-header">
          <div className="notif-dropdown-title">
            <Bell size={18} />
            <span>Thông báo</span>
            {unreadCount > 0 && <span className="notif-dropdown-count">{unreadCount}</span>}
          </div>
          <div className="notif-dropdown-actions">
            {unreadCount > 0 && (
              <button
                type="button"
                className="notif-mark-all-btn"
                onClick={onMarkAllRead}
                title="Đánh dấu tất cả đã đọc"
              >
                <CheckCheck size={16} />
                <span>Đọc hết</span>
              </button>
            )}
            <button type="button" className="notif-close-btn" onClick={onClose} aria-label="Đóng">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="notif-dropdown-list">
          {notifications.length === 0 ? (
            <div className="notif-empty">
              <Bell size={32} strokeWidth={1.5} />
              <p>Chưa có thông báo nào</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`notif-item ${n.is_read ? 'read' : 'unread'}`}
                onClick={() => onClickNotification(n)}
                role="button"
                tabIndex={0}
              >
                <div className="notif-item-dot-col">
                  {!n.is_read && <span className="notif-item-dot" />}
                </div>
                <div className="notif-item-content">
                  <div className="notif-item-title">{n.title}</div>
                  <div className="notif-item-msg">{n.message}</div>
                  <div className="notif-item-footer">
                    <span className="notif-item-time">{formatTime(n.created_at)}</span>
                    {n.action_url && (
                      <span className="notif-item-link">
                        <ExternalLink size={12} /> Xem chi tiết
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationDropdown;
