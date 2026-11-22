import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, User, Lock, Mail, Phone, Stethoscope, ShieldCheck, HeartPulse } from 'lucide-react';

export default function AuthModal({ isOpen, onClose }) {
  const { login, register, demoLogin } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        await register(name, email, password, phone);
      } else {
        await login(email, password);
      }
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async (roleEmail, rolePass) => {
    setError('');
    setLoading(true);
    try {
      await demoLogin(roleEmail, rolePass);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      backgroundColor: 'rgba(10, 37, 64, 0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div
        className="card animate-slide-down"
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'white',
          padding: '2rem',
          position: 'relative'
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'none',
            border: 'none',
            color: 'var(--slate-muted)',
            cursor: 'pointer'
          }}
        >
          <X size={22} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '1rem',
            background: 'var(--primary-light)',
            color: 'var(--primary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.75rem'
          }}>
            <HeartPulse size={30} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--navy)' }}>
            {isRegister ? 'Patient Registration' : 'Sign in to QueueCare'}
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--slate-muted)', marginTop: '0.25rem' }}>
            Hospital & Clinic Waiting-Time Management
          </p>
        </div>

        {/* 1-Click Demo Login Bar (College viva highlight) */}
        {!isRegister && (
          <div style={{
            background: '#f8fafc',
            border: '1px solid var(--slate-border)',
            borderRadius: '0.75rem',
            padding: '1rem',
            marginBottom: '1.5rem'
          }}>
            <p style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--primary-dark)',
              marginBottom: '0.5rem'
            }}>
              🚀 1-Click Demo Logins for Viva Defense:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-outline"
                style={{ fontSize: '0.75rem', padding: '0.45rem 0.65rem', justifyContent: 'flex-start' }}
                onClick={() => handleQuickDemo('patient4@example.com', 'patient123')}
              >
                <User size={14} color="var(--primary)" /> Ananya (Has Token A04)
              </button>
              <button
                type="button"
                className="btn btn-outline"
                style={{ fontSize: '0.75rem', padding: '0.45rem 0.65rem', justifyContent: 'flex-start' }}
                onClick={() => handleQuickDemo('patient1@example.com', 'patient123')}
              >
                <User size={14} color="var(--primary)" /> Aarav (New Walk-In)
              </button>
              <button
                type="button"
                className="btn btn-outline"
                style={{ fontSize: '0.75rem', padding: '0.45rem 0.65rem', justifyContent: 'flex-start' }}
                onClick={() => handleQuickDemo('sharma@queuecare.com', 'doctor123')}
              >
                <Stethoscope size={14} color="var(--blue)" /> Dr. Sharma (Cardiology)
              </button>
              <button
                type="button"
                className="btn btn-outline"
                style={{ fontSize: '0.75rem', padding: '0.45rem 0.65rem', justifyContent: 'flex-start' }}
                onClick={() => handleQuickDemo('admin@queuecare.com', 'admin123')}
              >
                <ShieldCheck size={14} color="#64748B" /> Administrator
              </button>
            </div>
          </div>
        )}

        {error && (
          <div style={{
            background: 'var(--coral-light)',
            color: 'var(--coral)',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            fontSize: '0.85rem',
            marginBottom: '1rem',
            fontWeight: 500
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {isRegister && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--slate-dark)' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--slate-dark)' }}>
                  Mobile Phone (for simulated SMS alerts)
                </label>
                <input
                  type="tel"
                  className="input-field"
                  placeholder="+91-9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--slate-dark)' }}>
              Email Address
            </label>
            <input
              type="email"
              required
              className="input-field"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--slate-dark)' }}>
              Password
            </label>
            <input
              type="password"
              required
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem' }}
            disabled={loading}
          >
            {loading ? 'Processing...' : (isRegister ? 'Register Account' : 'Sign In')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.85rem' }}>
          {isRegister ? (
            <p>
              Already registered?{' '}
              <button
                type="button"
                onClick={() => { setIsRegister(false); setError(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer' }}
              >
                Sign In
              </button>
            </p>
          ) : (
            <p>
              New patient?{' '}
              <button
                type="button"
                onClick={() => { setIsRegister(true); setError(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer' }}
              >
                Create Account
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
