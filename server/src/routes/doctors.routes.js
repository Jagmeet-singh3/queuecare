const express = require('express');
const router = express.Router();
const db = require('../db/database');
const queueManager = require('../queue/QueueManager');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

/**
 * GET /api/doctors
 * Lists all active doctors with live queue status, queue size, and estimated wait.
 */
router.get('/', (req, res) => {
  const doctors = db.prepare(`
    SELECT d.id, d.name, d.department, d.doctor_code, d.default_consult_time, d.is_active,
           u.email as doctor_email
    FROM doctors d
    LEFT JOIN users u ON d.user_id = u.id
    WHERE d.is_active = 1
    ORDER BY d.id ASC
  `).all();

  const today = queueManager.getTodayString();

  const enriched = doctors.map(doc => {
    const queue = queueManager.getQueue(doc.id, today);
    const isPaused = queueManager.isQueuePaused(doc.id, today);
    const avgConsult = queueManager.getDoctorAverageConsultationTime(doc.id);

    // Active patient currently being served
    const active = db.prepare(`
      SELECT token_display, status
      FROM appointments
      WHERE doctor_id = ? AND appointment_date = ? AND status IN ('called', 'in_consultation')
      ORDER BY called_at DESC LIMIT 1
    `).get(doc.id, today);

    return {
      ...doc,
      queueSize: queue.size(),
      isPaused,
      avgConsultTime: avgConsult,
      currentlyServing: active ? active.token_display : 'None'
    };
  });

  return res.json({ doctors: enriched });
});

/**
 * GET /api/doctors/:id
 */
router.get('/:id', (req, res) => {
  const doc = db.prepare(`SELECT * FROM doctors WHERE id = ?`).get(req.params.id);
  if (!doc) {
    return res.status(404).json({ error: 'Doctor not found' });
  }
  const avgConsult = queueManager.getDoctorAverageConsultationTime(doc.id);
  const queue = queueManager.getQueue(doc.id);
  const isPaused = queueManager.isQueuePaused(doc.id);

  return res.json({
    doctor: {
      ...doc,
      avgConsultTime: avgConsult,
      queueSize: queue.size(),
      isPaused
    }
  });
});

/**
 * POST /api/doctors
 * Admin adds new doctor
 */
router.post('/', verifyToken, requireRole('admin'), (req, res) => {
  const { name, department, doctor_code, default_consult_time } = req.body;

  if (!name || !department || !doctor_code) {
    return res.status(400).json({ error: 'Name, department, and doctor code (e.g. A, B) are required' });
  }

  const code = doctor_code.toUpperCase().trim();
  const existingCode = db.prepare(`SELECT id FROM doctors WHERE doctor_code = ?`).get(code);
  if (existingCode) {
    return res.status(400).json({ error: `Doctor code '${code}' is already assigned to another physician` });
  }

  const consultTime = parseInt(default_consult_time, 10) || 10;

  try {
    const info = db.prepare(`
      INSERT INTO doctors (name, department, doctor_code, default_consult_time, is_active)
      VALUES (?, ?, ?, ?, 1)
    `).run(name.trim(), department.trim(), code, consultTime);

    const newDoc = db.prepare(`SELECT * FROM doctors WHERE id = ?`).get(info.lastInsertRowid);
    return res.status(201).json({ message: 'Doctor created successfully', doctor: newDoc });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/doctors/:id
 * Admin edits doctor details (e.g. default consultation duration or status)
 */
router.put('/:id', verifyToken, requireRole('admin'), (req, res) => {
  const { name, department, default_consult_time, is_active } = req.body;
  const docId = req.params.id;

  const current = db.prepare(`SELECT * FROM doctors WHERE id = ?`).get(docId);
  if (!current) {
    return res.status(404).json({ error: 'Doctor not found' });
  }

  const updatedName = name ? name.trim() : current.name;
  const updatedDept = department ? department.trim() : current.department;
  const updatedTime = default_consult_time ? parseInt(default_consult_time, 10) : current.default_consult_time;
  const updatedActive = typeof is_active !== 'undefined' ? (is_active ? 1 : 0) : current.is_active;

  db.prepare(`
    UPDATE doctors 
    SET name = ?, department = ?, default_consult_time = ?, is_active = ?
    WHERE id = ?
  `).run(updatedName, updatedDept, updatedTime, updatedActive, docId);

  const updated = db.prepare(`SELECT * FROM doctors WHERE id = ?`).get(docId);

  // Broadcast change if active
  const broadcaster = req.app.get('socketBroadcaster');
  if (broadcaster) {
    broadcaster.broadcastQueueUpdate(docId);
  }

  return res.json({ message: 'Doctor updated successfully', doctor: updated });
});

module.exports = router;
