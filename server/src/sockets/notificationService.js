const db = require('../db/database');

/**
 * QueueCare Notification Service
 * Manages in-app notifications and simulates SMS / Email delivery via terminal logging.
 */
class NotificationService {
  constructor() {
    this.io = null;
  }

  setIO(ioInstance) {
    this.io = ioInstance;
  }

  /**
   * Records notification in DB, broadcasts via Socket.IO, and prints simulated SMS to console.
   */
  notify(userId, appointmentId, type, message) {
    // 1. Save in DB
    const stmt = db.prepare(`
      INSERT INTO notifications (user_id, appointment_id, type, message, is_read, channel)
      VALUES (?, ?, ?, ?, 0, 'simulated_sms')
    `);
    const info = stmt.run(userId, appointmentId, type, message);

    // Fetch user phone for simulation log
    const user = db.prepare(`SELECT name, phone, email FROM users WHERE id = ?`).get(userId);
    const recipientPhone = user?.phone || '+91-9876543210';
    const recipientName = user?.name || 'Patient';

    // 2. Simulated SMS Console Log
    console.log('\n============================================================');
    console.log(`📱 [SIMULATED SMS / PUSH NOTIFICATION]`);
    console.log(`To: ${recipientName} (${recipientPhone}) | Type: [${type.toUpperCase()}]`);
    console.log(`Message: "${message}"`);
    console.log(`Timestamp: ${new Date().toLocaleTimeString()} | DB ID: #${info.lastInsertRowid}`);
    console.log('============================================================\n');

    // 3. Emit real-time WebSocket event to user room
    if (this.io) {
      this.io.to(`user_${userId}`).emit('notification', {
        id: info.lastInsertRowid,
        appointmentId,
        type,
        message,
        createdAt: new Date().toISOString()
      });
    }

    return info.lastInsertRowid;
  }

  /**
   * Checks queue milestones (3 patients away, next in line) and triggers alerts without duplicate spam.
   * @param {number} doctorId
   * @param {Array<Object>} queueList
   * @param {string} doctorName
   */
  checkAndNotifyQueueMilestones(doctorId, queueList, doctorName) {
    for (let i = 0; i < queueList.length; i++) {
      const patient = queueList[i];
      const position = i + 1; // 1-based position in queue
      const patientsAhead = i;

      // Condition 1: Next in line (Position 1, 0 patients ahead)
      if (position === 1) {
        const alreadySent = db.prepare(`
          SELECT id FROM notifications 
          WHERE user_id = ? AND appointment_id = ? AND type = 'next_in_line'
        `).get(patient.patientId, patient.appointmentId);

        if (!alreadySent) {
          const msg = `Token ${patient.tokenDisplay}: You are NEXT in line for ${doctorName}! Please stand by outside the consultation room.`;
          this.notify(patient.patientId, patient.appointmentId, 'next_in_line', msg);
        }
      }

      // Condition 2: 3 patients away (Position 4, exactly 3 patients ahead; or position 3)
      if (patientsAhead === 3 || position === 3) {
        const alreadySent = db.prepare(`
          SELECT id FROM notifications 
          WHERE user_id = ? AND appointment_id = ? AND type = '3_ahead'
        `).get(patient.patientId, patient.appointmentId);

        if (!alreadySent) {
          const msg = `Token ${patient.tokenDisplay}: You are 3 patients away from seeing ${doctorName}. Please start heading toward the clinic.`;
          this.notify(patient.patientId, patient.appointmentId, '3_ahead', msg);
        }
      }
    }
  }

  /**
   * Triggered when doctor calls a patient.
   */
  notifyCalled(userId, appointmentId, tokenDisplay, doctorName) {
    const msg = `🔔 Token ${tokenDisplay} is CALLED! Please enter ${doctorName}'s consultation room now.`;
    this.notify(userId, appointmentId, 'called', msg);
  }

  /**
   * Triggered when patient is skipped.
   */
  notifySkipped(userId, appointmentId, tokenDisplay, skipCount, newPosition) {
    const msg = `⚠️ Token ${tokenDisplay} was skipped because you were not present. You have been placed at position #${newPosition} in the queue (Skip ${skipCount}/2).`;
    this.notify(userId, appointmentId, 'skipped', msg);
  }

  /**
   * Triggered when patient marked no-show after 2 skips.
   */
  notifyNoShow(userId, appointmentId, tokenDisplay, doctorName) {
    const msg = `❌ Token ${tokenDisplay} was marked as No-Show after 2 missed calls with ${doctorName}. Please visit the reception desk to reschedule.`;
    this.notify(userId, appointmentId, 'no_show', msg);
  }
}

const notificationService = new NotificationService();

module.exports = notificationService;
