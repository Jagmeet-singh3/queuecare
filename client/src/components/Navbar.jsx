import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { HeartPulse, Bell, LogOut, User, Activity, ShieldCheck, Stethoscope } from 'lucide-react';
import NotificationDrawer from './NotificationDrawer';

export default function Navbar({ onOpenAuth }) {
  const { user, isAuthenticated, logout, token } = useAuth();
  const { connected } = useSocket();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread notification count
  useEffect(() => {
    if (!token || !isAuthenticated) {
      setUnreadCount(0);
      return;
    }

    const checkCount = async () => {
      try {
        const res = await fetch('/api/notifications', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unreadCount || 0);
        }
      } catch (e) {
        // quiet
      }
    };

    checkCount();
    const interval = setInterval(checkCount, 15000);
    return () => clearInterval(interval);
  }, [token, isAuthenticated, drawerOpen]);

  const getRoleBadge = (role) => {
    switch (role) {
      case 'doctor':
        return <span className="badge badge-blue"><Stethoscope size={12} /> Doctor</span>;
      case 'admin':
        return <span className="badge badge-coral"><ShieldCheck size={12} /> Admin</span>;
      default:
        return <span className="badge badge-teal"><User size={12} /> Patient</span>;
    }
  };

  return (
    <>
      <header style={{
        background: 'white',
        borderBottom: '1px solid var(--slate-border)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div className="container" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '4.25rem'
        }}>
          {/* Brand Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '0.75rem',
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--blue) 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(0, 168, 150, 0.25)'
            }}>
              <HeartPulse size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--navy)', letterSpacing: '-0.02em' }}>
                  QueueCare
                </span>
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  background: 'var(--primary-light)',
                  color: 'var(--primary-dark)',
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}>
                  SE Capstone
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--slate-muted)', margin: 0, fontWeight: 500 }}>
                Hospital & Clinic Waiting-Time Management
              </p>
            </div>
          </div>

          {/* Right Header Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Live Socket Connection Status */}
            <div
              title={connected ? "Socket.IO Live Synchronization Active" : "Reconnecting to live queue..."}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: connected ? 'var(--green)' : 'var(--coral)',
                background: connected ? 'var(--green-light)' : 'var(--coral-light)',
                padding: '0.3rem 0.65rem',
                borderRadius: '9999px'
              }}
            >
              <span style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: connected ? 'var(--green)' : 'var(--coral)',
                display: 'inline-block'
              }} />
              {connected ? 'Live Sync' : 'Offline'}
            </div>

            {isAuthenticated ? (
              <>
                {/* Notification Bell */}
                <button
                  onClick={() => setDrawerOpen(true)}
                  style={{
                    position: 'relative',
                    background: 'none',
                    border: '1.5px solid var(--slate-border)',
                    borderRadius: '0.625rem',
                    width: '38px',
                    height: '38px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--slate-dark)',
                    transition: 'all 0.15s'
                  }}
                  title="View Notifications"
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      background: 'var(--coral)',
                      color: 'white',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid white'
                    }}>
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* User Info & Role */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ textAlign: 'right', display: 'none', minWidth: '100px' }} className="user-details-text">
                    <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--navy)', lineHeight: 1.2 }}>
                      {user.name}
                    </p>
                    <div style={{ marginTop: '2px' }}>{getRoleBadge(user.role)}</div>
                  </div>
                  <div>{getRoleBadge(user.role)}</div>
                </div>

                {/* Logout Button */}
                <button
                  onClick={logout}
                  className="btn btn-outline"
                  style={{ padding: '0.45rem 0.75rem', fontSize: '0.825rem' }}
                  title="Sign out of system"
                >
                  <LogOut size={16} />
                  <span>Exit</span>
                </button>
              </>
            ) : (
              <button
                onClick={onOpenAuth}
                className="btn btn-primary"
                style={{ padding: '0.5rem 1.15rem' }}
              >
                Sign In / Demo Login
              </button>
            )}
          </div>
        </div>
      </header>

      <NotificationDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
