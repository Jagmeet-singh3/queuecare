const queueManager = require('../queue/QueueManager');
const notificationService = require('./notificationService');
const db = require('../db/database');

function setupSocketIO(io) {
  notificationService.setIO(io);

  io.on('connection', (socket) => {
    // console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // User joins personal notification room
    socket.on('join_user', (userId) => {
      if (userId) {
        socket.join(`user_${userId}`);
        // console.log(`[Socket.IO] Socket ${socket.id} joined user_${userId}`);
      }
    });

    // Doctor joins doctor room for queue updates
    socket.on('join_doctor', (doctorId) => {
      if (doctorId) {
        socket.join(`doctor_${doctorId}`);
        // Send initial dashboard state immediately
        const data = queueManager.getDoctorDashboardData(doctorId);
        socket.emit('doctor_queue_updated', data);
      }
    });

    // Patient joins doctor queue channel to receive live queue ticks
    socket.on('join_patient_queue', ({ doctorId, appointmentId, userId }) => {
      if (doctorId) {
        socket.join(`doctor_${doctorId}`);
      }
      if (appointmentId) {
        socket.join(`appointment_${appointmentId}`);
        const tokenData = queueManager.getPatientTokenData(appointmentId);
        if (tokenData) {
          socket.emit('token_status_updated', tokenData);
        }
      }
      if (userId) {
        socket.join(`user_${userId}`);
      }
    });

    // Admin joins global telemetry channel
    socket.on('join_admin', () => {
      socket.join('admin_room');
    });

    socket.on('disconnect', () => {
      // console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  return {
    broadcastQueueUpdate: (doctorId) => {
      // 1. Update doctor console
      const docData = queueManager.getDoctorDashboardData(doctorId);
      io.to(`doctor_${doctorId}`).emit('doctor_queue_updated', docData);
      io.to('admin_room').emit('clinic_activity_updated', { doctorId });

      // 2. Fetch doctor name for notifications
      const doctor = db.prepare(`SELECT name FROM doctors WHERE id = ?`).get(doctorId);
      const doctorName = doctor ? doctor.name : 'Doctor';

      // 3. Scan milestones and alert patients
      const queue = queueManager.getQueue(doctorId);
      const queueList = queue.toArray();
      notificationService.checkAndNotifyQueueMilestones(doctorId, queueList, doctorName);

      // 4. Push updated token data to each active appointment
      const activeAppts = db.prepare(`
        SELECT id FROM appointments
        WHERE doctor_id = ? AND appointment_date = ? AND status IN ('waiting', 'called', 'in_consultation')
      `).all(doctorId, queueManager.getTodayString());

      for (const appt of activeAppts) {
        const tokenData = queueManager.getPatientTokenData(appt.id);
        if (tokenData) {
          io.to(`appointment_${appt.id}`).emit('token_status_updated', tokenData);
        }
      }
    }
  };
}

module.exports = setupSocketIO;
