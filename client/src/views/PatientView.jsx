import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  Clock,
  Users,
  CheckCircle2,
  AlertTriangle,
  Stethoscope,
  Ticket,
  PauseCircle,
  XCircle,
  Sparkles,
  ArrowRight,
  Info
} from 'lucide-react';

export default function PatientView({ onOpenAuth }) {
  const { user, token, isAuthenticated } = useAuth();
  const { socket, connected, addToast } = useSocket();

  const [activeToken, setActiveToken] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingDocId, setBookingDocId] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch active token for current patient
  const fetchMyActiveToken = async () => {
    if (!token || !isAuthenticated) {
      setActiveToken(null);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/appointments/my-active', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveToken(data.hasActive ? data.tokenData : null);
      }
    } catch (err) {
      console.error('Failed to load active token:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch doctors list
  const fetchDoctors = async () => {
    try {
      const res = await fetch('/api/doctors');
      if (res.ok) {
        const data = await res.json();
        setDoctors(data.doctors || []);
      }
    } catch (err) {
      console.error('Failed to load doctors:', err);
    }
  };

  useEffect(() => {
    fetchMyActiveToken();
    fetchDoctors();
  }, [token, isAuthenticated]);

  // Socket.IO event listener for real-time live token updates
  useEffect(() => {
    if (!socket) return;

    // Join patient queue room if active token exists
    if (activeToken) {
      socket.emit('join_patient_queue', {
        appointmentId: activeToken.appointmentId,
        doctorId: activeToken.doctorId,
        userId: user?.id
      });
    }

    const handleTokenUpdate = (updatedTokenData) => {
      if (activeToken && updatedTokenData.appointmentId === activeToken.appointmentId) {
        setActiveToken(updatedTokenData);
      }
    };

    const handleQueueChange = () => {
      fetchMyActiveToken();
      fetchDoctors();
    };

    socket.on('token_status_updated', handleTokenUpdate);
    socket.on('doctor_queue_updated', handleQueueChange);

    return () => {
      socket.off('token_status_updated', handleTokenUpdate);
      socket.off('doctor_queue_updated', handleQueueChange);
    };
  }, [socket, activeToken?.appointmentId, user?.id]);

  // Book appointment action
  const handleBookToken = async (doctorId) => {
    if (!isAuthenticated) {
      onOpenAuth();
      return;
    }

    setErrorMsg('');
    setBookingDocId(doctorId);

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ doctorId })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to book appointment');
      }

      setActiveToken(data.tokenData);
      addToast({
        title: 'Token Issued!',
        message: `Your token #${data.tokenData.tokenDisplay} is active. You can track your wait live here.`,
        icon: '🎟️',
        typeClass: 'badge-teal'
      });
      fetchDoctors();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setBookingDocId(null);
    }
  };

  // Cancel appointment action
  const handleCancelBooking = async () => {
    if (!activeToken || cancelling) return;
    if (!window.confirm('Are you sure you want to cancel your appointment token?')) return;

    setCancelling(true);
    try {
      const res = await fetch(`/api/appointments/${activeToken.appointmentId}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        addToast({
          title: 'Appointment Cancelled',
          message: 'Your token was removed from the active queue.',
          icon: 'ℹ️'
        });
        setActiveToken(null);
        fetchDoctors();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="container" style={{ padding: '2rem 1.25rem 4rem' }}>
      {/* Problem & Goal Mission Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0A2540 0%, #1E3A5F 100%)',
        borderRadius: '1.25rem',
        padding: '1.75rem 2rem',
        color: 'white',
        marginBottom: '2rem',
        boxShadow: '0 10px 25px -5px rgba(10, 37, 64, 0.25)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1.5rem'
      }}>
        <div style={{ maxWidth: '640px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(0, 168, 150, 0.25)', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, color: '#2dd4bf', marginBottom: '0.75rem' }}>
            <Sparkles size={14} /> Eliminating Clinic Wait-Time Blindness
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, lineHeight: 1.25, marginBottom: '0.5rem' }}>
            Transparent, Stress-Free Clinic Waiting
          </h1>
          <p style={{ color: '#cbd5e1', fontSize: '0.925rem', lineHeight: 1.5 }}>
            Never sit blindly in a packed waiting lobby again. Check in virtually, track your live token position, and arrive right when your doctor is ready.
          </p>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '1rem',
          padding: '1rem 1.25rem',
          display: 'flex',
          gap: '1.5rem'
        }}>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2dd4bf' }}>O(1)</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Fair FIFO Queue</div>
          </div>
          <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }} />
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8' }}>~91%</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Lobby Density Drop</div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div style={{
          background: 'var(--coral-light)',
          color: 'var(--coral)',
          padding: '1rem',
          borderRadius: '0.75rem',
          marginBottom: '1.5rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <AlertTriangle size={18} />
          {errorMsg}
        </div>
      )}

      {/* VIEW STATE 1: Patient holds an active token */}
      {activeToken ? (
        <div style={{ maxWidth: '780px', margin: '0 auto' }}>
          <div className="card" style={{ overflow: 'hidden', borderTop: '5px solid var(--primary)' }}>
            {/* Live Token Header */}
            <div style={{
              padding: '1.5rem 2rem',
              background: '#fbfcfd',
              borderBottom: '1px solid var(--slate-border)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem'
            }}>
              <div>
                <span className="badge badge-teal" style={{ marginBottom: '0.5rem' }}>
                  <Ticket size={14} /> LIVE TOKEN STATUS
                </span>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--navy)' }}>
                  {activeToken.doctorName}
                </h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--slate-muted)' }}>
                  {activeToken.department} Department
                </p>
              </div>

              {/* Status Pill */}
              <div>
                {activeToken.status === 'called' && (
                  <div className="badge badge-green animate-pulse-glow" style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}>
                    <CheckCircle2 size={16} /> YOU ARE CALLED! ENTER ROOM NOW
                  </div>
                )}
                {activeToken.status === 'in_consultation' && (
                  <div className="badge badge-blue" style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}>
                    <Stethoscope size={16} /> In Consultation with Doctor
                  </div>
                )}
                {activeToken.status === 'waiting' && !activeToken.isPaused && (
                  <div className="badge badge-teal" style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem' }}>
                    <Clock size={15} /> Waiting in Queue
                  </div>
                )}
                {activeToken.isPaused && (
                  <div className="badge badge-amber" style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem' }}>
                    <PauseCircle size={15} /> Queue Paused (Wait Frozen)
                  </div>
                )}
              </div>
            </div>

            {/* Main Token Metric Display */}
            <div style={{ padding: '2.5rem 2rem', textAlign: 'center' }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Your Assigned Token Number
              </p>
              <div style={{
                fontSize: '5rem',
                fontWeight: 900,
                color: 'var(--navy)',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
                margin: '0.5rem 0 1.5rem'
              }}>
                #{activeToken.tokenDisplay}
              </div>

              {/* 3 Telemetry Pillars */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1rem',
                marginBottom: '2rem'
              }}>
                {/* Now Serving */}
                <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '1rem', border: '1px solid var(--slate-border)' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--slate-muted)', textTransform: 'uppercase' }}>
                    Currently Serving
                  </p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--navy)', marginTop: '0.35rem' }}>
                    #{activeToken.currentlyServing || 'None'}
                  </p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--slate-muted)' }}>Inside doctor room</span>
                </div>

                {/* Patients Ahead */}
                <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '1rem', border: '1px solid var(--slate-border)' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--slate-muted)', textTransform: 'uppercase' }}>
                    Patients Ahead of You
                  </p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 800, color: activeToken.patientsAhead === 0 ? 'var(--green)' : 'var(--navy)', marginTop: '0.35rem' }}>
                    {activeToken.patientsAhead}
                  </p>
                  <span style={{ fontSize: '0.75rem', color: activeToken.patientsAhead === 0 ? 'var(--green)' : 'var(--slate-muted)' }}>
                    {activeToken.patientsAhead === 0 ? 'You are next in line!' : 'People ahead in FIFO queue'}
                  </span>
                </div>

                {/* Estimated Wait */}
                <div style={{
                  background: activeToken.isPaused ? 'var(--amber-light)' : 'var(--primary-light)',
                  padding: '1.25rem',
                  borderRadius: '1rem',
                  border: activeToken.isPaused ? '1px solid var(--amber)' : '1px solid rgba(0, 168, 150, 0.4)'
                }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, color: activeToken.isPaused ? 'var(--amber)' : 'var(--primary-dark)', textTransform: 'uppercase' }}>
                    Estimated Waiting Time
                  </p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 800, color: activeToken.isPaused ? '#92400e' : 'var(--primary-dark)', marginTop: '0.35rem' }}>
                    {activeToken.formattedWaitText}
                  </p>
                  <span style={{ fontSize: '0.75rem', color: activeToken.isPaused ? '#92400e' : 'var(--primary-dark)' }}>
                    {activeToken.isPaused ? 'Wait projection frozen' : 'Rolling average calculated'}
                  </span>
                </div>
              </div>

              {/* Informative Guidance Box */}
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #86efac',
                borderRadius: '0.875rem',
                padding: '1rem 1.25rem',
                textAlign: 'left',
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'flex-start',
                marginBottom: '1.5rem'
              }}>
                <Info size={20} color="#15803d" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '0.85rem', color: '#166534', lineHeight: 1.5 }}>
                  <strong>Smart Remote Waiting Enabled:</strong> You do not need to wait in the crowded clinic reception.
                  You will automatically receive an in-app alert and simulated SMS when you are <strong>3 patients away</strong>,
                  giving you ample time to arrive at the consultation room.
                </div>
              </div>

              {/* Cancel Button */}
              {activeToken.status === 'waiting' && (
                <button
                  onClick={handleCancelBooking}
                  disabled={cancelling}
                  className="btn btn-outline"
                  style={{ color: 'var(--coral)', borderColor: '#fca5a5', padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
                >
                  <XCircle size={16} />
                  {cancelling ? 'Cancelling...' : 'Cancel Appointment Booking'}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* VIEW STATE 2: Patient has no token -> Book a doctor */
        <div>
          <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--navy)' }}>
                Select a Doctor to Join Virtual Queue
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--slate-muted)' }}>
                Choose your physician to receive an instant sequential token and live wait estimate.
              </p>
            </div>
            {!isAuthenticated && (
              <button onClick={onOpenAuth} className="btn btn-primary">
                Sign in to Book Token
              </button>
            )}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.25rem'
          }}>
            {doctors.map((doc) => {
              const estimatedWait = Math.round(doc.queueSize * doc.avgConsultTime);
              return (
                <div key={doc.id} className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <span className="badge badge-teal">
                        Doctor Code: {doc.doctor_code}
                      </span>
                      {doc.isPaused ? (
                        <span className="badge badge-amber"><PauseCircle size={12} /> Paused</span>
                      ) : (
                        <span className="badge badge-green"><CheckCircle2 size={12} /> On Duty</span>
                      )}
                    </div>

                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--navy)', marginBottom: '0.2rem' }}>
                      {doc.name}
                    </h3>
                    <p style={{ fontSize: '0.875rem', color: 'var(--blue)', fontWeight: 600, marginBottom: '1.25rem' }}>
                      {doc.department}
                    </p>

                    <div style={{
                      background: '#f8fafc',
                      borderRadius: '0.75rem',
                      padding: '0.875rem',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '0.75rem',
                      marginBottom: '1.25rem',
                      border: '1px solid var(--slate-border)'
                    }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--slate-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                          In Queue
                        </div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--navy)' }}>
                          {doc.queueSize} patients
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--slate-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                          Est. Wait Time
                        </div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary-dark)' }}>
                          ~{estimatedWait} mins
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleBookToken(doc.id)}
                    disabled={bookingDocId === doc.id}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '0.75rem' }}
                  >
                    {bookingDocId === doc.id ? (
                      'Generating Token...'
                    ) : (
                      <>
                        <span>Get Token & Join Queue</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
