import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [toasts, setToasts] = useState([]);

  // Toast auto-dismiss helper
  const addToast = (toast) => {
    const id = Date.now() + Math.random();
    const newToast = { id, ...toast };
    setToasts((prev) => [newToast, ...prev].slice(0, 5)); // Keep max 5 active toasts

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    const s = io('/', {
      transports: ['websocket', 'polling']
    });

    s.on('connect', () => {
      // console.log('[Socket.IO Client] Connected:', s.id);
      setConnected(true);

      // Re-join user room if user is logged in
      if (user?.id) {
        s.emit('join_user', user.id);
      }
    });

    s.on('disconnect', () => {
      // console.log('[Socket.IO Client] Disconnected');
      setConnected(false);
    });

    // Real-time Push Notification alert handler
    s.on('notification', (notif) => {
      let icon = '🔔';
      let title = 'Queue Update';
      let typeClass = 'badge-blue';

      if (notif.type === 'called') {
        icon = '🚨';
        title = 'YOU ARE CALLED!';
        typeClass = 'badge-green';
      } else if (notif.type === 'next_in_line') {
        icon = '⚡';
        title = 'You are Next in Line!';
        typeClass = 'badge-teal';
      } else if (notif.type === '3_ahead') {
        icon = '⏳';
        title = '3 Patients Away';
        typeClass = 'badge-amber';
      } else if (notif.type === 'skipped') {
        icon = '⚠️';
        title = 'Token Skipped';
        typeClass = 'badge-coral';
      } else if (notif.type === 'no_show') {
        icon = '❌';
        title = 'Marked as No-Show';
        typeClass = 'badge-coral';
      }

      addToast({
        title,
        message: notif.message,
        icon,
        typeClass
      });
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  // When user changes, join user room
  useEffect(() => {
    if (socket && connected && user?.id) {
      socket.emit('join_user', user.id);
    }
  }, [socket, connected, user]);

  return (
    <SocketContext.Provider value={{ socket, connected, toasts, addToast, removeToast }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
