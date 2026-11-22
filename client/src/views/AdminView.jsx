import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  Clock,
  TrendingUp,
  AlertTriangle,
  Stethoscope,
  Plus,
  Edit2,
  Calendar,
  Filter,
  CheckCircle2,
  BarChart2,
  Activity
} from 'lucide-react';

export default function AdminView() {
  const { token } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [range, setRange] = useState('all');
  const [selectedDate, setSelectedDate] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddDocModal, setShowAddDocModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [docFormData, setDocFormData] = useState({
    name: '',
    department: '',
    doctor_code: '',
    default_consult_time: 10
  });

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      let query = `?range=${range}`;
      if (selectedDate) {
        query = `?date=${selectedDate}`;
      }
      const res = await fetch(`/api/admin/analytics${query}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctorsList = async () => {
    try {
      const res = await fetch('/api/doctors');
      if (res.ok) {
        const data = await res.json();
        setDoctors(data.doctors || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    fetchDoctorsList();
  }, [range, selectedDate, token]);

  // Handle Add Doctor
  const handleAddDoctor = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/doctors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(docFormData)
      });
      if (res.ok) {
        setShowAddDocModal(false);
        setDocFormData({ name: '', department: '', doctor_code: '', default_consult_time: 10 });
        fetchDoctorsList();
        fetchAnalytics();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to add doctor');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Handle Edit Doctor
  const handleEditDoctor = async (e) => {
    e.preventDefault();
    if (!editingDoc) return;
    try {
      const res = await fetch(`/api/doctors/${editingDoc.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editingDoc.name,
          department: editingDoc.department,
          default_consult_time: editingDoc.default_consult_time,
          is_active: editingDoc.is_active
        })
      });
      if (res.ok) {
        setEditingDoc(null);
        fetchDoctorsList();
        fetchAnalytics();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to update doctor');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Peak Hours max calculation for responsive bar scaling
  const maxHourlyPatients = analytics?.peakHoursChart
    ? Math.max(...analytics.peakHoursChart.map(p => p.patients), 1)
    : 1;

  return (
    <div className="container" style={{ padding: '2rem 1.25rem 4rem' }}>
      {/* Title & Filter Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <span className="badge badge-teal" style={{ marginBottom: '0.4rem' }}>
            <Activity size={14} /> ADMINISTRATIVE TELEMETRY SUITE
          </span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--navy)' }}>
            Hospital Clinic Operations & Analytics
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--slate-muted)' }}>
            Real-time throughput metrics, wait-time analysis, peak congestion, and physician management.
          </p>
        </div>

        {/* Date Filter Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', padding: '0.4rem 0.6rem', borderRadius: '0.75rem', border: '1px solid var(--slate-border)' }}>
          <Filter size={16} color="var(--slate-muted)" />
          {['all', 'today', 'week', 'month'].map((f) => (
            <button
              key={f}
              onClick={() => { setRange(f); setSelectedDate(''); }}
              style={{
                background: range === f && !selectedDate ? 'var(--primary)' : 'none',
                color: range === f && !selectedDate ? 'white' : 'var(--slate-dark)',
                border: 'none',
                borderRadius: '0.5rem',
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {f === 'all' ? 'All Time' : (f === 'today' ? 'Today' : `Last ${f === 'week' ? '7 Days' : '30 Days'}`)}
            </button>
          ))}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => { setSelectedDate(e.target.value); setRange(''); }}
            style={{
              border: '1px solid var(--slate-border)',
              borderRadius: '0.5rem',
              padding: '0.3rem 0.5rem',
              fontSize: '0.8rem',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1.25rem',
        marginBottom: '2rem'
      }}>
        {/* KPI 1: Average Consultation Duration */}
        <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--blue)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-muted)', textTransform: 'uppercase' }}>
              Avg Consult Duration
            </span>
            <div style={{ background: 'var(--blue-light)', color: 'var(--blue)', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={16} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--navy)' }}>
            {analytics?.summary?.avgConsultTimeMinutes || 7.5} min
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--slate-muted)', marginTop: '0.25rem' }}>
            Rolling mean across completed visits
          </p>
        </div>

        {/* KPI 2: Average Waiting Time */}
        <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-muted)', textTransform: 'uppercase' }}>
              Avg Patient Wait Time
            </span>
            <div style={{ background: 'var(--primary-light)', color: 'var(--primary)', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={16} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--primary-dark)' }}>
            {analytics?.summary?.avgWaitTimeMinutes || 18.2} min
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--slate-muted)', marginTop: '0.25rem' }}>
            From virtual token check-in to call
          </p>
        </div>

        {/* KPI 3: Total Completed Visits */}
        <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--green)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-muted)', textTransform: 'uppercase' }}>
              Patients Served
            </span>
            <div style={{ background: 'var(--green-light)', color: 'var(--green)', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={16} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--navy)' }}>
            {analytics?.summary?.completed || 0}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--slate-muted)', marginTop: '0.25rem' }}>
            Out of {analytics?.summary?.totalBooked || 0} total bookings
          </p>
        </div>

        {/* KPI 4: No-Show Rate */}
        <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--coral)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-muted)', textTransform: 'uppercase' }}>
              No-Show Rate
            </span>
            <div style={{ background: 'var(--coral-light)', color: 'var(--coral)', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={16} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--coral)' }}>
            {analytics?.summary?.noShowRate || 0}%
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--slate-muted)', marginTop: '0.25rem' }}>
            {analytics?.summary?.noShows || 0} missed calls (2x skipped)
          </p>
        </div>
      </div>

      {/* Grid: Peak Hours Chart + Doctor Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        {/* Chart 1: Peak Inflow Hours (Bar Chart) */}
        <div className="card" style={{ padding: '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--navy)' }}>
                Peak Arrival Hours
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--slate-muted)' }}>
                Patient token check-in frequency (08:00 - 18:00)
              </p>
            </div>
            <BarChart2 size={20} color="var(--primary)" />
          </div>

          {/* SVG Responsive Bar Chart */}
          <div style={{ height: '220px', display: 'flex', alignItems: 'flex-end', gap: '0.5rem', paddingBottom: '1.75rem', borderBottom: '1px solid var(--slate-border)' }}>
            {analytics?.peakHoursChart?.map((item) => {
              const heightPct = Math.max(6, Math.round((item.patients / maxHourlyPatients) * 100));
              const isPeak = item.patients >= maxHourlyPatients * 0.75 && item.patients > 0;
              return (
                <div
                  key={item.hour}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    height: '100%',
                    justifyContent: 'flex-end',
                    position: 'relative'
                  }}
                  title={`${item.hour}: ${item.patients} patients`}
                >
                  {item.patients > 0 && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: isPeak ? 'var(--primary-dark)' : 'var(--slate-muted)', marginBottom: '0.25rem' }}>
                      {item.patients}
                    </span>
                  )}
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '28px',
                      height: `${heightPct}%`,
                      background: isPeak
                        ? 'linear-gradient(180deg, var(--primary) 0%, #008f80 100%)'
                        : '#cbd5e1',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.4s ease'
                    }}
                  />
                  <span style={{
                    position: 'absolute',
                    bottom: '-1.5rem',
                    fontSize: '0.65rem',
                    color: 'var(--slate-muted)',
                    whiteSpace: 'nowrap'
                  }}>
                    {item.hour.split(':')[0]}h
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', fontSize: '0.75rem', color: 'var(--slate-muted)' }}>
            <span>Operational Day: 08:00 AM</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '10px', height: '10px', background: 'var(--primary)', borderRadius: '2px', display: 'inline-block' }} /> Peak Traffic
            </span>
            <span>Close: 06:00 PM</span>
          </div>
        </div>

        {/* Breakdown 2: Patients Served per Doctor */}
        <div className="card" style={{ padding: '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--navy)' }}>
                Patients Served per Doctor
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--slate-muted)' }}>
                Consultation completions by clinician
              </p>
            </div>
            <Stethoscope size={20} color="var(--blue)" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {analytics?.doctorBreakdown?.map((doc) => {
              const completed = doc.completed_count || 0;
              const total = doc.total_booked || 0;
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
              return (
                <div key={doc.id} style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--slate-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <div>
                      <span style={{ fontWeight: 800, color: 'var(--navy)', fontSize: '0.95rem' }}>
                        {doc.doctor_name}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--slate-muted)', marginLeft: '0.5rem' }}>
                        ({doc.department})
                      </span>
                    </div>
                    <span style={{ fontWeight: 800, color: 'var(--primary-dark)', fontSize: '0.95rem' }}>
                      {completed} Completed
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'var(--primary)', borderRadius: '9999px' }} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--slate-muted)' }}>
                    <span>Queue active: {doc.waiting_count || 0} waiting</span>
                    <span>No-shows: {doc.no_show_count || 0}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Doctor Management Table Section */}
      <div className="card" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--navy)' }}>
              Physician & Consultation Management
            </h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--slate-muted)' }}>
              Configure doctor profiles, department assignments, and baseline consultation duration.
            </p>
          </div>
          <button
            onClick={() => setShowAddDocModal(true)}
            className="btn btn-primary"
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            <Plus size={16} /> Add New Doctor
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--slate-border)', color: 'var(--slate-muted)', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Code</th>
                <th style={{ padding: '0.75rem 1rem' }}>Doctor Name</th>
                <th style={{ padding: '0.75rem 1rem' }}>Department</th>
                <th style={{ padding: '0.75rem 1rem' }}>Default Consult Time</th>
                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {doctors.map((d) => (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--slate-border)' }}>
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 800, color: 'var(--primary-dark)' }}>
                    #{d.doctor_code}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 700, color: 'var(--navy)' }}>
                    {d.name}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', color: 'var(--slate-dark)' }}>
                    {d.department}
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <span className="badge badge-blue">
                      {d.default_consult_time} mins
                    </span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    {d.is_active ? (
                      <span className="badge badge-green">Active</span>
                    ) : (
                      <span className="badge badge-coral">Inactive</span>
                    )}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                    <button
                      onClick={() => setEditingDoc({ ...d })}
                      className="btn btn-outline"
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                    >
                      <Edit2 size={13} /> Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add Doctor */}
      {showAddDocModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(10,37,64,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card animate-slide-down" style={{ width: '100%', maxWidth: '440px', padding: '1.75rem', background: 'white' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--navy)', marginBottom: '1rem' }}>
              Add New Physician
            </h3>
            <form onSubmit={handleAddDoctor} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Full Name</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder="e.g. Dr. Sunita Rao"
                  value={docFormData.name}
                  onChange={(e) => setDocFormData({ ...docFormData, name: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Department / Specialty</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder="e.g. Dermatology"
                  value={docFormData.department}
                  onChange={(e) => setDocFormData({ ...docFormData, department: e.target.value })}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Doctor Code (Letter)</label>
                  <input
                    type="text"
                    required
                    maxLength={2}
                    className="input-field"
                    placeholder="e.g. D"
                    value={docFormData.doctor_code}
                    onChange={(e) => setDocFormData({ ...docFormData, doctor_code: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Default Consult (Mins)</label>
                  <input
                    type="number"
                    min="3"
                    max="60"
                    required
                    className="input-field"
                    value={docFormData.default_consult_time}
                    onChange={(e) => setDocFormData({ ...docFormData, default_consult_time: parseInt(e.target.value, 10) })}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowAddDocModal(false)} className="btn btn-outline">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Doctor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Doctor */}
      {editingDoc && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(10,37,64,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card animate-slide-down" style={{ width: '100%', maxWidth: '440px', padding: '1.75rem', background: 'white' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--navy)', marginBottom: '1rem' }}>
              Edit Physician Profile
            </h3>
            <form onSubmit={handleEditDoctor} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Doctor Name</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  value={editingDoc.name}
                  onChange={(e) => setEditingDoc({ ...editingDoc, name: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Department</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  value={editingDoc.department}
                  onChange={(e) => setEditingDoc({ ...editingDoc, department: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Default Consultation Time (Minutes)</label>
                <input
                  type="number"
                  min="3"
                  max="60"
                  required
                  className="input-field"
                  value={editingDoc.default_consult_time}
                  onChange={(e) => setEditingDoc({ ...editingDoc, default_consult_time: parseInt(e.target.value, 10) })}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setEditingDoc(null)} className="btn btn-outline">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Update Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
