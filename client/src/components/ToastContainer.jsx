import React from 'react';
import { useSocket } from '../context/SocketContext';
import { X, Bell } from 'lucide-react';

export default function ToastContainer() {
  const { toasts, removeToast } = useSocket();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '1rem',
      right: '1rem',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
      maxWidth: '380px',
      width: 'calc(100% - 2rem)'
    }}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="card animate-slide-down"
          style={{
            padding: '1rem',
            borderLeft: '4px solid var(--primary)',
            background: 'white',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
            position: 'relative'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.4rem' }}>{toast.icon || '🔔'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--navy)' }}>
                  {toast.title}
                </span>
                <button
                  onClick={() => removeToast(toast.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--slate-muted)',
                    cursor: 'pointer',
                    padding: '2px'
                  }}
                >
                  <X size={16} />
                </button>
              </div>
              <p style={{ fontSize: '0.825rem', color: 'var(--slate-dark)', lineHeight: 1.4 }}>
                {toast.message}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
