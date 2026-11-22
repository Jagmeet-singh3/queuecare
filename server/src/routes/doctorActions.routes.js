const express = require('express');
const router = express.Router();
const db = require('../db/database');
const queueManager = require('../queue/QueueManager');
const notificationService = require('../sockets/notificationService');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

// Helper to determine doctor ID for the logged-in doctor user
function resolveDoctorId(req) {
  if (req.user.doctorId) {
    return req.user.doctorId;
  }
  const doc = db.prepare(`SELECT id FROM doctors WHERE user_id = ?`).get(req.user.id);
  return doc ? doc.id : null;
}

/**
 * GET /api/doctor/dashboard
 * Doctor retrieves full live console state:
 * Current patient, next 4 in queue, queue size, paused status, and average consult duration.
 */
router.get('/dashboard', verifyToken, requireRole('doctor', 'admin'), (req, res) => {
  let doctorId = resolveDoctorId(req);
  if (req.user.role === 'admin' && req.query.doctorId) {
    doctorId = parseInt(req.query.doctorId, 10);
  }

  if (!doctorId) {
    return res.status(400).json({ error: 'Doctor account is not linked to a clinical doctor profile' });
  }

  const dashboardData = queueManager.getDoctorDashboardData(doctorId);
  const doctor = db.prepare(`SELECT id, name, department, doctor_code FROM doctors WHERE id = ?`).get(doctorId);

  return res.json({
    doctor,
    ...dashboardData
  });
});

/**
 * POST /api/doctor/call-next
 * Calls the next patient at the head of the FIFO queue.
 */
router.post('/call-next', verifyToken, requireRole('doctor'), (req, res) => {
  const doctorId = resolveDoctorId(req);
  if (!doctorId) {
    return res.status(400).json({ error: 'Doctor profile not found' });
  }

  const result = queueManager.callNext(doctorId);
  if (!result.success) {
    return res.status(400).json({ error: result.message });
  }

  const doctor = db.prepare(`SELECT name FROM doctors WHERE id = ?`).get(doctorId);
  const doctorName = doctor ? doctor.name : 'Doctor';

  // Trigger alert
  notificationService.notifyCalled(
    result.calledPatient.patientId,
    result.calledPatient.appointmentId,
    result.calledPatient.tokenDisplay,
    doctorName
  );

  // Broadcast WebSocket update
  const broadcaster = req.app.get('socketBroadcaster');
  if (broadcaster) {
    broadcaster.broadcastQueueUpdate(doctorId);
  }

  return res.json({
    message: `Called Token ${result.calledPatient.tokenDisplay}`,
    calledPatient: result.calledPatient,
    remainingQueueSize: result.remainingQueueSize
  });
});

/**
 * POST /api/doctor/start-consultation
 * Starts the clinical consultation for the currently called patient.
 */
router.post('/start-consultation', verifyToken, requireRole('doctor'), (req, res) => {
  const doctorId = resolveDoctorId(req);
  const { appointmentId } = req.body;

  if (!appointmentId) {
    return res.status(400).json({ error: 'appointmentId is required' });
  }

  queueManager.startConsultation(doctorId, appointmentId);

  const broadcaster = req.app.get('socketBroadcaster');
  if (broadcaster) {
    broadcaster.broadcastQueueUpdate(doctorId);
  }

  return res.json({ message: 'Consultation started successfully' });
});

/**
 * POST /api/doctor/complete
 * Marks current consultation as completed.
 * Automatically computes consultation duration for rolling mean.
 */
router.post('/complete', verifyToken, requireRole('doctor'), (req, res) => {
  const doctorId = resolveDoctorId(req);
  const { appointmentId } = req.body;

  const result = queueManager.completeConsultation(doctorId, appointmentId);
  if (!result.success) {
    return res.status(400).json({ error: result.message });
  }

  const broadcaster = req.app.get('socketBroadcaster');
  if (broadcaster) {
    broadcaster.broadcastQueueUpdate(doctorId);
  }

  return res.json({
    message: 'Consultation completed successfully',
    completedAppointmentId: result.completedAppointmentId
  });
});

/**
 * POST /api/doctor/skip
 * Doctor skips the current or specified patient.
 * Moves them back by 3 spots. If skipped 2 times, marks as no-show.
 */
router.post('/skip', verifyToken, requireRole('doctor'), (req, res) => {
  const doctorId = resolveDoctorId(req);
  const { appointmentId } = req.body;

  const result = queueManager.skipPatient(doctorId, appointmentId);
  if (!result.success) {
    return res.status(400).json({ error: result.message });
  }

  const doctor = db.prepare(`SELECT name FROM doctors WHERE id = ?`).get(doctorId);
  const doctorName = doctor ? doctor.name : 'Doctor';

  if (result.action === 'marked_no_show') {
    notificationService.notifyNoShow(
      result.patient.patient_id,
      result.patient.id,
      result.patient.token_display,
      doctorName
    );
  } else if (result.action === 'skipped') {
    notificationService.notifySkipped(
      result.patient.patientId || result.patient.patient_id,
      result.patient.appointmentId || result.patient.id,
      result.patient.tokenDisplay || result.patient.token_display,
      result.patient.skipCount || 1,
      result.newPosition
    );
  }

  const broadcaster = req.app.get('socketBroadcaster');
  if (broadcaster) {
    broadcaster.broadcastQueueUpdate(doctorId);
  }

  return res.json({
    message: result.message,
    action: result.action,
    newPosition: result.newPosition || null
  });
});

/**
 * POST /api/doctor/toggle-pause
 * Doctor pauses or resumes their queue.
 * When paused, patient wait-time estimates freeze and state shows "Queue Paused".
 */
router.post('/toggle-pause', verifyToken, requireRole('doctor'), (req, res) => {
  const doctorId = resolveDoctorId(req);
  const currentPaused = queueManager.isQueuePaused(doctorId);
  const newPausedState = !currentPaused;

  queueManager.setQueuePaused(doctorId, newPausedState);

  const doctor = db.prepare(`SELECT name FROM doctors WHERE id = ?`).get(doctorId);
  const doctorName = doctor ? doctor.name : 'Doctor';

  // Broadcast to all connected clients
  const broadcaster = req.app.get('socketBroadcaster');
  if (broadcaster) {
    broadcaster.broadcastQueueUpdate(doctorId);
  }

  return res.json({
    message: newPausedState ? 'Queue paused. Wait times frozen.' : 'Queue resumed.',
    isPaused: newPausedState
  });
});

module.exports = router;
