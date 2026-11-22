import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { X, CheckCheck, Bell } from 'lucide-react';

export default function NotificationDrawer({ isOpen, onClose }) {
  const { token, isAuthenticated } = useAuth();
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    if (!token || !isAuthenticated) return;
    try {
      setLoading(true);
      const res = await fetch('/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, token]);

  // Listen for live notifications
  useEffect(() => {
    if (!socket) return;
    const handleNotif = () => {
      fetchNotifications();
    };
    socket.on('notification', handleNotif);
    return () => socket.off('notification', handleNotif);
  }, [socket]);

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9998,
      backgroundColor: 'rgba(15, 23, 42, 0.4)',
      backdropFilter: 'blur(3px)',
      display: 'flex',
      justifyContent: 'flex-end'
    }}>
      <div
        className="animate-slide-down"
        style={{
          width: '100%',
          maxWidth: '420px',
          height: '100%',
          background: 'white',
          boxShadow: '-4px 0 25px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--slate-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#fafafa'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy)' }}>
              Notifications & Alerts
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={markAllAsRead}
              title="Mark all as read"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.8rem',
                fontWeight: 600
              }}
            >
              <CheckCheck size={16} /> Mark all
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--slate-muted)',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--slate-muted)' }}>
              Loading alerts...
            </div>
          )}

          {!loading && notifications.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--slate-muted)' }}>
              <Bell size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
              <p style={{ fontWeight: 600 }}>No notifications yet</p>
              <p style={{ fontSize: '0.85rem' }}>You will receive real-time alerts when your turn approaches.</p>
            </div>
          )}

          {!loading && notifications.map((n) => (
            <div
              key={n.id}
              style={{
                padding: '0.875rem 1rem',
                borderRadius: '0.75rem',
                marginBottom: '0.75rem',
                border: '1px solid var(--slate-border)',
                background: n.is_read ? '#f8fafc' : 'var(--primary-light)',
                borderLeft: n.is_read ? '3px solid #cbd5e1' : '3px solid var(--primary)',
                transition: 'background 0.2s'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span className={`badge ${n.is_read ? 'badge-blue' : 'badge-teal'}`} style={{ fontSize: '0.7rem' }}>
                  {n.type.toUpperCase().replace('_', ' ')}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--slate-muted)' }}>
                  {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--slate-dark)', lineHeight: 1.4 }}>
                {n.message}
              </p>
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div style={{
          padding: '0.875rem 1.25rem',
          borderTop: '1px solid var(--slate-border)',
          background: '#f8fafc',
          fontSize: '0.785rem',
          color: 'var(--slate-muted)',
          textAlign: 'center'
        }}>
          💡 Alerts are also mirrored as simulated SMS/email messages in the server console.
        </div>
      </div>
    </div>
  );
}
