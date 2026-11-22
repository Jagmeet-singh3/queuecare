import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  Bell,
  SkipForward,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  Users,
  Clock,
  UserCheck,
  AlertCircle,
  Timer,
  Stethoscope
} from 'lucide-react';

export default function DoctorView() {
  const { user, token } = useAuth();
  const { socket, addToast } = useSocket();

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Fetch full doctor dashboard state
  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/doctor/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDashboard(data);
      }
    } catch (err) {
      console.error('Failed to load doctor dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [token]);

  // Socket.IO real-time listener for doctor queue updates
  useEffect(() => {
    if (!socket || !dashboard?.doctorId) return;

    socket.emit('join_doctor', dashboard.doctorId);

    const handleUpdate = (updatedData) => {
      setDashboard(prev => ({
        ...prev,
        ...updatedData
      }));
    };

    socket.on('doctor_queue_updated', handleUpdate);
    return () => socket.off('doctor_queue_updated', handleUpdate);
  }, [socket, dashboard?.doctorId]);

  // Live timer for active patient consultation duration
  useEffect(() => {
    let timer;
    if (dashboard?.currentPatient) {
      const startTime = new Date(dashboard.currentPatient.started_at || dashboard.currentPatient.called_at).getTime();
      const updateTimer = () => {
        const now = Date.now();
        const diff = Math.max(0, Math.floor((now - startTime) / 1000));
        setElapsedSeconds(diff);
      };
      updateTimer();
      timer = setInterval(updateTimer, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(timer);
  }, [dashboard?.currentPatient?.id, dashboard?.currentPatient?.started_at, dashboard?.currentPatient?.called_at]);

  const formatTimer = (secs) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}`;
  };

  // Action: Call Next Patient
  const handleCallNext = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/doctor/call-next', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      addToast({
        title: 'Patient Called',
        message: `Token #${data.calledPatient.tokenDisplay} called into consultation room.`,
        icon: '🔔',
        typeClass: 'badge-green'
      });
      fetchDashboard();
    } catch (err) {
      addToast({ title: 'Notice', message: err.message, icon: '⚠️' });
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Skip Patient
  const handleSkip = async () => {
    if (!dashboard?.currentPatient && dashboard?.totalWaiting === 0) {
      addToast({ title: 'Notice', message: 'No patient available to skip.', icon: '⚠️' });
      return;
    }

    const currentSkipCount = dashboard?.currentPatient?.skip_count || 0;
    const isSecondSkip = currentSkipCount >= 1;
    const confirmMsg = isSecondSkip
      ? 'This is the 2nd skip for this patient. Skipping again will automatically mark them as NO-SHOW. Proceed?'
      : 'Skip this patient? They will be moved back 3 positions in the queue.';

    if (!window.confirm(confirmMsg)) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/doctor/skip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ appointmentId: dashboard.currentPatient?.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      addToast({
        title: data.action === 'marked_no_show' ? 'Marked No-Show' : 'Patient Skipped',
        message: data.message,
        icon: data.action === 'marked_no_show' ? '❌' : '⏭️'
      });
      fetchDashboard();
    } catch (err) {
      addToast({ title: 'Error', message: err.message, icon: '⚠️' });
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Complete Consultation
  const handleComplete = async () => {
    if (!dashboard?.currentPatient) {
      addToast({ title: 'Notice', message: 'No active patient to complete.', icon: 'ℹ️' });
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch('/api/doctor/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ appointmentId: dashboard.currentPatient.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      addToast({
        title: 'Consultation Complete',
        message: `Consultation logged (${formatTimer(elapsedSeconds)}). Rolling average recalculated.`,
        icon: '✅',
        typeClass: 'badge-teal'
      });
      fetchDashboard();
    } catch (err) {
      addToast({ title: 'Error', message: err.message, icon: '⚠️' });
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Toggle Queue Pause
  const handleTogglePause = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/doctor/toggle-pause', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      addToast({
        title: data.isPaused ? 'Queue Paused' : 'Queue Resumed',
        message: data.message,
        icon: data.isPaused ? '⏸️' : '▶️'
      });
      fetchDashboard();
    } catch (err) {
      addToast({ title: 'Error', message: err.message, icon: '⚠️' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '4rem 1.25rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--slate-muted)' }}>Loading doctor clinical console...</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2rem 1.25rem 4rem' }}>
      {/* Doctor Header Bar */}
      <div className="card" style={{ padding: '1.5rem 2rem', marginBottom: '1.75rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className="badge badge-blue">
              <Stethoscope size={14} /> Doctor Clinical Console
            </span>
            {dashboard.isPaused ? (
              <span className="badge badge-amber"><PauseCircle size={14} /> Queue Paused</span>
            ) : (
              <span className="badge badge-green"><PlayCircle size={14} /> Queue Active</span>
            )}
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--navy)' }}>
            {dashboard.doctor?.name || user.name}
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--slate-muted)' }}>
            {dashboard.doctor?.department || 'Cardiology'} | Room OPD-3 | Doctor Code: {dashboard.doctor?.doctor_code || 'A'}
          </p>
        </div>

        {/* Rolling consult metrics & pause control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--slate-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Rolling Consult Average
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary-dark)' }}>
              {dashboard.avgConsultTime} min
            </div>
          </div>

          <button
            onClick={handleTogglePause}
            disabled={actionLoading}
            className={`btn ${dashboard.isPaused ? 'btn-success' : 'btn-amber'}`}
            style={{ padding: '0.625rem 1.15rem' }}
          >
            {dashboard.isPaused ? <PlayCircle size={18} /> : <PauseCircle size={18} />}
            <span>{dashboard.isPaused ? 'Resume Queue' : 'Pause Queue'}</span>
          </button>
        </div>
      </div>

      {/* Grid: Left Column = Active Patient & 4 Controls, Right Column = Upcoming Queue */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {/* Left Column: Active Patient Console */}
        <div>
          {/* Active Patient Card */}
          <div className="card" style={{ padding: '1.75rem', marginBottom: '1.5rem', borderTop: '4px solid var(--blue)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span className="badge badge-blue">
                <UserCheck size={14} /> CURRENT PATIENT IN ROOM
              </span>
              {dashboard.currentPatient && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: 'var(--navy)',
                  background: '#f1f5f9',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '9999px'
                }}>
                  <Timer size={15} color="var(--primary)" />
                  <span>{formatTimer(elapsedSeconds)}</span>
                </div>
              )}
            </div>

            {dashboard.currentPatient ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--navy)' }}>
                    #{dashboard.currentPatient.token_display}
                  </span>
                  <span className="badge badge-green" style={{ textTransform: 'uppercase' }}>
                    {dashboard.currentPatient.status}
                  </span>
                </div>

                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', marginBottom: '1.25rem', border: '1px solid var(--slate-border)' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--slate-dark)' }}>
                    {dashboard.currentPatient.patient_name}
                  </div>
                  <div style={{ fontSize: '0.825rem', color: 'var(--slate-muted)', marginTop: '0.2rem' }}>
                    Phone: {dashboard.currentPatient.patient_phone || 'Simulated patient'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--slate-muted)', marginTop: '0.2rem' }}>
                    Called at: {new Date(dashboard.currentPatient.called_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {dashboard.currentPatient.skip_count > 0 && (
                      <span style={{ color: 'var(--coral)', fontWeight: 700, marginLeft: '0.5rem' }}>
                        (Skipped {dashboard.currentPatient.skip_count}x previously)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--slate-muted)' }}>
                <Clock size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
                <p style={{ fontWeight: 700, color: 'var(--slate-dark)' }}>No patient currently in room</p>
                <p style={{ fontSize: '0.85rem' }}>Click "Call Next Patient" to admit the next token in the FIFO queue.</p>
              </div>
            )}

            {/* 4 Core Doctor Actions */}
            <div style={{ marginTop: '1.5rem' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                Doctor Flow Actions (1-Click)
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {/* 1. Call Next */}
                <button
                  onClick={handleCallNext}
                  disabled={actionLoading || dashboard.totalWaiting === 0}
                  className="btn btn-primary"
                  style={{ padding: '0.85rem 1rem' }}
                >
                  <Bell size={18} />
                  <span>Call Next</span>
                </button>

                {/* 2. Skip (+3 spots) */}
                <button
                  onClick={handleSkip}
                  disabled={actionLoading || (!dashboard.currentPatient && dashboard.totalWaiting === 0)}
                  className="btn btn-danger"
                  style={{ padding: '0.85rem 1rem' }}
                >
                  <SkipForward size={18} />
                  <span>Skip (+3 spots)</span>
                </button>

                {/* 3. Mark Complete */}
                <button
                  onClick={handleComplete}
                  disabled={actionLoading || !dashboard.currentPatient}
                  className="btn btn-success"
                  style={{ padding: '0.85rem 1rem', gridColumn: 'span 2' }}
                >
                  <CheckCircle2 size={18} />
                  <span>Mark Consultation Complete</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Next in Queue (FIFO) */}
        <div>
          <div className="card" style={{ padding: '1.75rem', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--navy)' }}>
                  Upcoming Queue Roster
                </h3>
                <p style={{ fontSize: '0.825rem', color: 'var(--slate-muted)' }}>
                  FIFO order per linked-list queue
                </p>
              </div>
              <span className="badge badge-teal" style={{ fontSize: '0.85rem' }}>
                <Users size={14} /> {dashboard.totalWaiting} Waiting
              </span>
            </div>

            {/* Next 4 Queue List */}
            {dashboard.nextInQueue && dashboard.nextInQueue.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {dashboard.nextInQueue.map((item, idx) => (
                  <div
                    key={item.appointmentId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.875rem 1rem',
                      borderRadius: '0.75rem',
                      border: '1px solid var(--slate-border)',
                      background: idx === 0 ? 'var(--primary-light)' : '#f8fafc',
                      borderLeft: idx === 0 ? '4px solid var(--primary)' : '1px solid var(--slate-border)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: idx === 0 ? 'var(--primary)' : '#e2e8f0',
                        color: idx === 0 ? 'white' : 'var(--slate-dark)',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {idx + 1}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--navy)', fontSize: '1rem' }}>
                          #{item.tokenDisplay}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--slate-muted)' }}>
                          {item.patientName}
                          {item.skipCount > 0 && (
                            <span style={{ color: 'var(--coral)', fontWeight: 600, marginLeft: '0.35rem' }}>
                              (Skip #{item.skipCount})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span className="badge badge-teal" style={{ fontSize: '0.75rem' }}>
                        ~{item.estimatedWait} min wait
                      </span>
                    </div>
                  </div>
                ))}

                {dashboard.totalWaiting > 4 && (
                  <div style={{ textAlign: 'center', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--slate-muted)' }}>
                    + {dashboard.totalWaiting - 4} more patients waiting in queue
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--slate-muted)' }}>
                <Users size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
                <p style={{ fontWeight: 700 }}>Queue is empty</p>
                <p style={{ fontSize: '0.85rem' }}>All checked-in patients have been served!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
