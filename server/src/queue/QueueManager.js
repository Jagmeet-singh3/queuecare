const db = require('../db/database');
const { PatientQueue } = require('./PatientQueue');
const {
  calculateRollingAverageConsultationTime,
  calculateEstimatedWait
} = require('./waitEstimator');

/**
 * QueueManager
 * Coordinates in-memory PatientQueue instances for all doctors with DB persistence.
 * Guarantees queue state survives server restarts by re-hydrating from SQLite.
 */
class QueueManager {
  constructor() {
    /** @type {Map<string, PatientQueue>} Key: "doctorId_YYYY-MM-DD" */
    this.queues = new Map();
  }

  /**
   * Helper to format today's date in local YYYY-MM-DD
   */
  getTodayString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getQueueKey(doctorId, dateStr = null) {
    const date = dateStr || this.getTodayString();
    return `${doctorId}_${date}`;
  }

  /**
   * Get or initialize PatientQueue instance for doctor and date.
   * Rehydrates from DB if not already loaded in memory.
   * @param {number} doctorId
   * @param {string} [dateStr]
   * @returns {PatientQueue}
   */
  getQueue(doctorId, dateStr = null) {
    const date = dateStr || this.getTodayString();
    const key = this.getQueueKey(doctorId, date);

    if (this.queues.has(key)) {
      return this.queues.get(key);
    }

    // Rehydrate from DB
    const queue = new PatientQueue(doctorId);
    const waitingAppointments = db.prepare(`
      SELECT a.id as appointmentId, a.token_number as tokenNumber, a.token_display as tokenDisplay,
             a.patient_id as patientId, u.name as patientName, a.skip_count as skipCount,
             a.status, a.queue_position as queuePosition
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      WHERE a.doctor_id = ? AND a.appointment_date = ? AND a.status = 'waiting'
      ORDER BY a.queue_position ASC, a.id ASC
    `).all(doctorId, date);

    for (const appt of waitingAppointments) {
      queue.enqueue({
        appointmentId: appt.appointmentId,
        tokenNumber: appt.tokenNumber,
        tokenDisplay: appt.tokenDisplay,
        patientId: appt.patientId,
        patientName: appt.patientName,
        skipCount: appt.skipCount || 0
      });
    }

    // Ensure queue_state row exists in DB
    const state = db.prepare(`SELECT * FROM queue_state WHERE doctor_id = ? AND date = ?`).get(doctorId, date);
    if (!state) {
      db.prepare(`
        INSERT INTO queue_state (doctor_id, date, is_paused)
        VALUES (?, ?, 0)
      `).run(doctorId, date);
    }

    this.queues.set(key, queue);
    return queue;
  }

  /**
   * Persists in-memory queue positions back to SQLite appointments table.
   * @param {number} doctorId
   * @param {string} [dateStr]
   */
  persistQueuePositions(doctorId, dateStr = null) {
    const date = dateStr || this.getTodayString();
    const queue = this.getQueue(doctorId, date);
    const list = queue.toArray();

    const updateStmt = db.prepare(`
      UPDATE appointments 
      SET queue_position = ?, skip_count = ?
      WHERE id = ?
    `);

    const updateMany = db.transaction((items) => {
      for (let i = 0; i < items.length; i++) {
        updateStmt.run(i + 1, items[i].skipCount || 0, items[i].appointmentId);
      }
    });

    updateMany(list);
  }

  /**
   * Add a new appointment to doctor's queue.
   */
  enqueuePatient(doctorId, appointmentData) {
    const queue = this.getQueue(doctorId);
    queue.enqueue(appointmentData);
    this.persistQueuePositions(doctorId);
    return queue.size();
  }

  /**
   * Removes appointment from queue (e.g. cancelled).
   */
  removePatient(doctorId, appointmentId) {
    const queue = this.getQueue(doctorId);
    const removed = queue.remove(appointmentId);
    if (removed) {
      this.persistQueuePositions(doctorId);
    }
    return removed;
  }

  /**
   * Checks if queue is paused.
   */
  isQueuePaused(doctorId, dateStr = null) {
    const date = dateStr || this.getTodayString();
    const row = db.prepare(`SELECT is_paused FROM queue_state WHERE doctor_id = ? AND date = ?`).get(doctorId, date);
    return row ? Boolean(row.is_paused) : false;
  }

  /**
   * Toggles pause state for doctor's queue.
   */
  setQueuePaused(doctorId, paused = true) {
    const date = this.getTodayString();
    const isPausedInt = paused ? 1 : 0;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO queue_state (doctor_id, date, is_paused, paused_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(doctor_id, date) DO UPDATE SET
        is_paused = excluded.is_paused,
        paused_at = CASE WHEN excluded.is_paused = 1 THEN excluded.paused_at ELSE NULL END,
        updated_at = excluded.updated_at
    `).run(doctorId, date, isPausedInt, paused ? now : null, now);

    return paused;
  }

  /**
   * Get doctor's rolling average consultation duration.
   * Last 10 completed consultations today or historically.
   */
  getDoctorAverageConsultationTime(doctorId) {
    const doctor = db.prepare(`SELECT default_consult_time FROM doctors WHERE id = ?`).get(doctorId);
    const defaultTime = doctor ? doctor.default_consult_time : 10;

    // Fetch up to 10 most recently completed consultations
    const rows = db.prepare(`
      SELECT started_at, completed_at,
             (julianday(completed_at) - julianday(started_at)) * 24 * 60 as duration_minutes
      FROM appointments
      WHERE doctor_id = ? AND status = 'completed' AND started_at IS NOT NULL AND completed_at IS NOT NULL
      ORDER BY completed_at DESC
      LIMIT 10
    `).all(doctorId);

    const durations = rows.map(r => r.duration_minutes).filter(d => d > 0);
    return calculateRollingAverageConsultationTime(durations, defaultTime, 10);
  }

  /**
   * Call next patient in queue.
   * 1. If currently active patient in consultation, mark them completed or ensure state is clean.
   * 2. Dequeue next patient from PatientQueue.
   * 3. Update appointment status to 'called' and record called_at.
   */
  callNext(doctorId) {
    const date = this.getTodayString();
    const queue = this.getQueue(doctorId, date);

    if (queue.isEmpty()) {
      return { success: false, message: 'Queue is currently empty' };
    }

    const nextPatient = queue.dequeue();
    const now = new Date().toISOString();

    // Update appointment in DB to 'called'
    db.prepare(`
      UPDATE appointments
      SET status = 'called', called_at = ?, queue_position = 0
      WHERE id = ?
    `).run(now, nextPatient.appointmentId);

    // Update queue_state current_appointment_id
    db.prepare(`
      UPDATE queue_state
      SET current_appointment_id = ?, updated_at = ?
      WHERE doctor_id = ? AND date = ?
    `).run(nextPatient.appointmentId, now, doctorId, date);

    this.persistQueuePositions(doctorId, date);

    return {
      success: true,
      calledPatient: nextPatient,
      remainingQueueSize: queue.size()
    };
  }

  /**
   * Start consultation (Doctor begins examining called patient).
   */
  startConsultation(doctorId, appointmentId) {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE appointments
      SET status = 'in_consultation', started_at = ?
      WHERE id = ? AND doctor_id = ?
    `).run(now, appointmentId, doctorId);

    return { success: true };
  }

  /**
   * Mark active consultation complete.
   */
  completeConsultation(doctorId, appointmentId = null) {
    const date = this.getTodayString();
    const now = new Date().toISOString();

    let targetApptId = appointmentId;
    if (!targetApptId) {
      const state = db.prepare(`SELECT current_appointment_id FROM queue_state WHERE doctor_id = ? AND date = ?`).get(doctorId, date);
      targetApptId = state ? state.current_appointment_id : null;
    }

    if (!targetApptId) {
      // Look for any 'called' or 'in_consultation' appointment for doctor today
      const active = db.prepare(`
        SELECT id FROM appointments 
        WHERE doctor_id = ? AND appointment_date = ? AND status IN ('called', 'in_consultation')
        ORDER BY id DESC LIMIT 1
      `).get(doctorId, date);
      targetApptId = active ? active.id : null;
    }

    if (!targetApptId) {
      return { success: false, message: 'No active patient to complete' };
    }

    // Set started_at if not set (fallback to called_at or now)
    db.prepare(`
      UPDATE appointments
      SET status = 'completed',
          started_at = COALESCE(started_at, called_at, ?),
          completed_at = ?
      WHERE id = ?
    `).run(now, now, targetApptId);

    // Clear current_appointment_id in queue_state
    db.prepare(`
      UPDATE queue_state
      SET current_appointment_id = NULL, updated_at = ?
      WHERE doctor_id = ? AND date = ?
    `).run(now, doctorId, date);

    return { success: true, completedAppointmentId: targetApptId };
  }

  /**
   * Skip a patient:
   * Moves them back by 3 positions in the queue.
   * If skipped >= 2 times, auto-mark as 'no_show'.
   */
  skipPatient(doctorId, appointmentId = null) {
    const date = this.getTodayString();
    const queue = this.getQueue(doctorId, date);

    let targetId = appointmentId;
    if (!targetId) {
      // If none provided, check currently called patient or queue head
      const state = db.prepare(`SELECT current_appointment_id FROM queue_state WHERE doctor_id = ? AND date = ?`).get(doctorId, date);
      targetId = state ? state.current_appointment_id : (queue.peek() ? queue.peek().appointmentId : null);
    }

    if (!targetId) {
      return { success: false, message: 'No patient to skip' };
    }

    // Check existing skip count in DB
    const appt = db.prepare(`SELECT * FROM appointments WHERE id = ?`).get(targetId);
    if (!appt) {
      return { success: false, message: 'Appointment not found' };
    }

    const currentSkips = appt.skip_count || 0;

    // Rule: "after 2 skips mark as no-show"
    if (currentSkips >= 1) {
      // This is the 2nd skip -> Mark as 'no_show'
      queue.remove(targetId);
      db.prepare(`
        UPDATE appointments
        SET status = 'no_show', skip_count = ?, queue_position = 0
        WHERE id = ?
      `).run(currentSkips + 1, targetId);

      // Clear from queue_state if active
      db.prepare(`
        UPDATE queue_state
        SET current_appointment_id = NULL
        WHERE doctor_id = ? AND date = ? AND current_appointment_id = ?
      `).run(doctorId, date, targetId);

      this.persistQueuePositions(doctorId, date);

      return {
        success: true,
        action: 'marked_no_show',
        message: `Token ${appt.token_display} skipped twice and marked as No-Show.`,
        patient: appt
      };
    }

    // If it was the called patient, re-insert them into the queue at position 3
    if (appt.status === 'called' || appt.status === 'in_consultation') {
      // Re-enqueue at front, then skip by 3
      queue.enqueue({
        appointmentId: appt.id,
        tokenNumber: appt.token_number,
        tokenDisplay: appt.token_display,
        patientId: appt.patient_id,
        patientName: db.prepare(`SELECT name FROM users WHERE id = ?`).get(appt.patient_id)?.name || 'Patient',
        skipCount: currentSkips
      });

      // Clear active patient in queue_state
      db.prepare(`
        UPDATE queue_state
        SET current_appointment_id = NULL
        WHERE doctor_id = ? AND date = ?
      `).run(doctorId, date);
    }

    // Perform queue skip
    const skipResult = queue.skip(targetId, 3);
    if (skipResult) {
      db.prepare(`
        UPDATE appointments
        SET status = 'waiting', skip_count = ?
        WHERE id = ?
      `).run(skipResult.skipCount, targetId);

      this.persistQueuePositions(doctorId, date);

      return {
        success: true,
        action: 'skipped',
        message: `Token ${appt.token_display} moved back 3 spots in queue (Skip #${skipResult.skipCount}).`,
        patient: skipResult.patient,
        newPosition: skipResult.newPosition
      };
    }

    return { success: false, message: 'Could not skip patient in queue' };
  }

  /**
   * Get full view for doctor's live dashboard:
   * - Current patient (called or in_consultation)
   * - Next 4 in queue
   * - Total queue size
   * - Queue paused state
   * - Doctor average consultation duration
   */
  getDoctorDashboardData(doctorId) {
    const date = this.getTodayString();
    const queue = this.getQueue(doctorId, date);
    const isPaused = this.isQueuePaused(doctorId, date);
    const avgConsultTime = this.getDoctorAverageConsultationTime(doctorId);

    // Current active patient
    const activeAppt = db.prepare(`
      SELECT a.*, u.name as patient_name, u.phone as patient_phone
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      WHERE a.doctor_id = ? AND a.appointment_date = ? AND a.status IN ('called', 'in_consultation')
      ORDER BY a.called_at DESC
      LIMIT 1
    `).get(doctorId, date);

    // Upcoming patients (all in queue)
    const queueArray = queue.toArray();
    const next4 = queueArray.slice(0, 4).map((item, idx) => {
      const waitInfo = calculateEstimatedWait(idx, avgConsultTime, isPaused);
      return {
        ...item,
        queuePosition: idx + 1,
        estimatedWait: waitInfo.estimatedWaitMinutes,
        formattedWaitText: waitInfo.formattedWaitText
      };
    });

    return {
      doctorId,
      isPaused,
      avgConsultTime,
      currentPatient: activeAppt || null,
      nextInQueue: next4,
      totalWaiting: queue.size()
    };
  }

  /**
   * Get patient's live token screen details:
   * - Doctor name & department
   * - My token display
   * - Currently serving token
   * - Patients ahead
   * - Estimated wait in minutes
   * - Status (waiting, called, in_consultation, completed, skipped, no_show, cancelled)
   */
  getPatientTokenData(appointmentId) {
    const appt = db.prepare(`
      SELECT a.*, d.name as doctor_name, d.department, d.doctor_code
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      WHERE a.id = ?
    `).get(appointmentId);

    if (!appt) {
      return null;
    }

    const doctorId = appt.doctor_id;
    const date = appt.appointment_date;
    const isPaused = this.isQueuePaused(doctorId, date);
    const avgConsultTime = this.getDoctorAverageConsultationTime(doctorId);

    // Get currently serving token
    const servingAppt = db.prepare(`
      SELECT token_display, status, called_at, started_at
      FROM appointments
      WHERE doctor_id = ? AND appointment_date = ? AND status IN ('called', 'in_consultation')
      ORDER BY called_at DESC LIMIT 1
    `).get(doctorId, date);

    const queue = this.getQueue(doctorId, date);
    const position = queue.getPosition(appointmentId);
    const patientsAhead = position > 0 ? position - 1 : 0;

    const waitCalculation = calculateEstimatedWait(patientsAhead, avgConsultTime, isPaused);

    return {
      appointmentId: appt.id,
      tokenDisplay: appt.token_display,
      tokenNumber: appt.token_number,
      status: appt.status,
      skipCount: appt.skip_count,
      doctorName: appt.doctor_name,
      department: appt.department,
      currentlyServing: servingAppt ? servingAppt.token_display : 'None',
      patientsAhead: appt.status === 'waiting' ? patientsAhead : 0,
      queuePosition: position > 0 ? position : 0,
      estimatedWaitMinutes: appt.status === 'waiting' ? waitCalculation.estimatedWaitMinutes : 0,
      formattedWaitText: appt.status === 'called' 
        ? 'Please proceed to doctor room!' 
        : (appt.status === 'in_consultation' ? 'In Consultation' : waitCalculation.formattedWaitText),
      isPaused,
      createdAt: appt.created_at,
      calledAt: appt.called_at
    };
  }
}

// Singleton QueueManager instance
const queueManager = new QueueManager();

module.exports = queueManager;
