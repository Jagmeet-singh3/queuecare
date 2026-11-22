const express = require('express');
const router = express.Router();
const db = require('../db/database');
const queueManager = require('../queue/QueueManager');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

/**
 * POST /api/appointments
 * Patient books an appointment and gets a token
 */
router.post('/', verifyToken, requireRole('patient'), (req, res) => {
  const { doctorId } = req.body;
  const patientId = req.user.id;

  if (!doctorId) {
    return res.status(400).json({ error: 'doctorId is required to book an appointment' });
  }

  const doctor = db.prepare(`SELECT * FROM doctors WHERE id = ? AND is_active = 1`).get(doctorId);
  if (!doctor) {
    return res.status(404).json({ error: 'Doctor not found or not currently active' });
  }

  const today = queueManager.getTodayString();

  // Check if patient already has an active appointment with this doctor today
  const existingActive = db.prepare(`
    SELECT id, token_display, status
    FROM appointments
    WHERE patient_id = ? AND doctor_id = ? AND appointment_date = ? AND status IN ('waiting', 'called', 'in_consultation')
  `).get(patientId, doctorId, today);

  if (existingActive) {
    return res.status(400).json({
      error: `You already hold active Token ${existingActive.token_display} for ${doctor.name} today.`,
      activeAppointmentId: existingActive.id
    });
  }

  // Generate sequential token number for this doctor for today
  // Atomic transaction
  const bookTx = db.transaction(() => {
    const lastTokenRow = db.prepare(`
      SELECT MAX(token_number) as maxToken
      FROM appointments
      WHERE doctor_id = ? AND appointment_date = ?
    `).get(doctorId, today);

    const nextTokenNumber = (lastTokenRow?.maxToken || 0) + 1;
    // Format: e.g. A01, A37, B04
    const tokenDisplay = `${doctor.doctor_code}${String(nextTokenNumber).padStart(2, '0')}`;

    const stmt = db.prepare(`
      INSERT INTO appointments (
        patient_id, doctor_id, token_number, token_display, status, skip_count, appointment_date
      ) VALUES (?, ?, ?, ?, 'waiting', 0, ?)
    `);

    const info = stmt.run(patientId, doctorId, nextTokenNumber, tokenDisplay, today);
    const appointmentId = info.lastInsertRowid;

    // Add to in-memory queue
    const patientName = req.user.name;
    queueManager.enqueuePatient(doctorId, {
      appointmentId,
      tokenNumber: nextTokenNumber,
      tokenDisplay,
      patientId,
      patientName,
      skipCount: 0
    });

    return { appointmentId, tokenNumber: nextTokenNumber, tokenDisplay };
  });

  try {
    const bookingResult = bookTx();

    // Broadcast queue update to Doctor and Patients via WebSocket
    const broadcaster = req.app.get('socketBroadcaster');
    if (broadcaster) {
      broadcaster.broadcastQueueUpdate(doctorId);
    }

    const tokenData = queueManager.getPatientTokenData(bookingResult.appointmentId);

    return res.status(201).json({
      message: 'Appointment booked successfully',
      tokenData
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to book appointment: ' + err.message });
  }
});

/**
 * GET /api/appointments/my-active
 * Retrieves the logged-in patient's currently active token (if any)
 */
router.get('/my-active', verifyToken, requireRole('patient'), (req, res) => {
  const patientId = req.user.id;
  const today = queueManager.getTodayString();

  const activeAppt = db.prepare(`
    SELECT id
    FROM appointments
    WHERE patient_id = ? AND appointment_date = ? AND status IN ('waiting', 'called', 'in_consultation')
    ORDER BY id DESC LIMIT 1
  `).get(patientId, today);

  if (!activeAppt) {
    return res.json({ hasActive: false, tokenData: null });
  }

  const tokenData = queueManager.getPatientTokenData(activeAppt.id);
  return res.json({ hasActive: true, tokenData });
});

/**
 * GET /api/appointments/:id
 * Retrieves specific appointment token details
 */
router.get('/:id', verifyToken, (req, res) => {
  const tokenData = queueManager.getPatientTokenData(req.params.id);
  if (!tokenData) {
    return res.status(404).json({ error: 'Appointment not found' });
  }

  // Security check: patients can only view their own appointments; doctors and admins can view any
  if (req.user.role === 'patient') {
    const appt = db.prepare(`SELECT patient_id FROM appointments WHERE id = ?`).get(req.params.id);
    if (!appt || appt.patient_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  return res.json({ tokenData });
});

/**
 * POST /api/appointments/:id/cancel
 * Patient cancels their appointment
 */
router.post('/:id/cancel', verifyToken, requireRole('patient'), (req, res) => {
  const appointmentId = req.params.id;
  const patientId = req.user.id;

  const appt = db.prepare(`SELECT * FROM appointments WHERE id = ?`).get(appointmentId);
  if (!appt) {
    return res.status(404).json({ error: 'Appointment not found' });
  }

  if (appt.patient_id !== patientId) {
    return res.status(403).json({ error: 'You cannot cancel an appointment that belongs to another patient' });
  }

  if (!['waiting'].includes(appt.status)) {
    return res.status(400).json({ error: `Cannot cancel an appointment with status '${appt.status}'` });
  }

  // Remove from queue and mark as cancelled
  queueManager.removePatient(appt.doctor_id, appt.id);
  db.prepare(`UPDATE appointments SET status = 'cancelled', queue_position = 0 WHERE id = ?`).run(appointmentId);

  // Broadcast queue update to doctor and remaining patients
  const broadcaster = req.app.get('socketBroadcaster');
  if (broadcaster) {
    broadcaster.broadcastQueueUpdate(appt.doctor_id);
  }

  return res.json({ message: 'Appointment cancelled successfully' });
});

module.exports = router;
