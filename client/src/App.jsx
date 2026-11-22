import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import ToastContainer from './components/ToastContainer';
import AuthModal from './components/AuthModal';
import PatientView from './views/PatientView';
import DoctorView from './views/DoctorView';
import AdminView from './views/AdminView';
import { HeartPulse, User, Stethoscope, ShieldCheck, HelpCircle } from 'lucide-react';

export default function App() {
  const { user, isAuthenticated, loading, demoLogin } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-page)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'var(--primary-light)',
            color: 'var(--primary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem'
          }}>
            <HeartPulse size={28} className="animate-pulse-glow" />
          </div>
          <p style={{ fontWeight: 700, color: 'var(--navy)' }}>Loading QueueCare System...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar onOpenAuth={() => setAuthModalOpen(true)} />
      <ToastContainer />
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />

      {/* Main View based on Logged-in User Role */}
      <main style={{ flex: 1 }}>
        {user?.role === 'doctor' && <DoctorView />}
        {user?.role === 'admin' && <AdminView />}
        {(!user || user?.role === 'patient') && (
          <PatientView onOpenAuth={() => setAuthModalOpen(true)} />
        )}
      </main>

      {/* College Project Viva Defense Demo Bar at bottom */}
      <footer style={{
        background: '#0A2540',
        color: '#94a3b8',
        padding: '1.25rem 1rem',
        borderTop: '1px solid #1e3a5f',
        fontSize: '0.8rem'
      }}>
        <div className="container" style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem'
        }}>
          <div>
            <span style={{ fontWeight: 700, color: 'white', marginRight: '0.5rem' }}>
              QueueCare: Hospital & Clinic Waiting-Time Management
            </span>
            <span>Software Engineering College Capstone Project</span>
          </div>

          {/* Quick Role Switcher for Presentation & Professor Viva */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8' }}>
              Switch View:
            </span>
            <button
              onClick={() => demoLogin('patient4@example.com', 'patient123')}
              style={{
                background: user?.email === 'patient4@example.com' ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                color: 'white',
                border: 'none',
                padding: '0.25rem 0.55rem',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.75rem'
              }}
            >
              <User size={12} /> Patient (Ananya)
            </button>
            <button
              onClick={() => demoLogin('sharma@queuecare.com', 'doctor123')}
              style={{
                background: user?.email === 'sharma@queuecare.com' ? 'var(--blue)' : 'rgba(255,255,255,0.1)',
                color: 'white',
                border: 'none',
                padding: '0.25rem 0.55rem',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.75rem'
              }}
            >
              <Stethoscope size={12} /> Doctor (Dr. Sharma)
            </button>
            <button
              onClick={() => demoLogin('admin@queuecare.com', 'admin123')}
              style={{
                background: user?.role === 'admin' ? '#475569' : 'rgba(255,255,255,0.1)',
                color: 'white',
                border: 'none',
                padding: '0.25rem 0.55rem',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.75rem'
              }}
            >
              <ShieldCheck size={12} /> Administrator
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
