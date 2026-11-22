const bcrypt = require('bcryptjs');
const db = require('./database');
const path = require('path');

function runSeed() {
  console.log('🌱 Starting QueueCare database seed...');

  // Enable foreign keys
  db.pragma('foreign_keys = OFF'); // temporarily off to reset tables safely

  // Clear existing tables
  db.exec(`
    DELETE FROM notifications;
    DELETE FROM queue_state;
    DELETE FROM appointments;
    DELETE FROM doctors;
    DELETE FROM users;
    DELETE FROM sqlite_sequence;
  `);

  db.pragma('foreign_keys = ON');

  const defaultPasswordHash = bcrypt.hashSync('patient123', 10);
  const doctorPasswordHash = bcrypt.hashSync('doctor123', 10);
  const adminPasswordHash = bcrypt.hashSync('admin123', 10);

  // 1. Create Admin
  const adminStmt = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, phone)
    VALUES (?, ?, ?, 'admin', ?)
  `);
  adminStmt.run('Hospital Administrator', 'admin@queuecare.com', adminPasswordHash, '+91-9876543200');

  // 2. Create Doctors & Doctor Users
  const doctorsData = [
    {
      name: 'Dr. Rajesh Sharma',
      email: 'sharma@queuecare.com',
      department: 'Cardiology',
      code: 'A',
      defaultTime: 12,
      phone: '+91-9876543201'
    },
    {
      name: 'Dr. Priya Mehta',
      email: 'mehta@queuecare.com',
      department: 'Pediatrics',
      code: 'B',
      defaultTime: 10,
      phone: '+91-9876543202'
    },
    {
      name: 'Dr. Farhan Khan',
      email: 'khan@queuecare.com',
      department: 'General Medicine',
      code: 'C',
      defaultTime: 8,
      phone: '+91-9876543203'
    }
  ];

  const userStmt = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, phone)
    VALUES (?, ?, ?, 'doctor', ?)
  `);
  const docStmt = db.prepare(`
    INSERT INTO doctors (user_id, name, department, doctor_code, default_consult_time, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `);

  const doctorIds = {};

  for (const doc of doctorsData) {
    const userRes = userStmt.run(doc.name, doc.email, doctorPasswordHash, doc.phone);
    const docRes = docStmt.run(userRes.lastInsertRowid, doc.name, doc.department, doc.code, doc.defaultTime);
    doctorIds[doc.code] = docRes.lastInsertRowid;
  }

  // 3. Create 10 Demo Patients
  const patientsData = [
    { name: 'Aarav Patel', email: 'patient1@example.com', phone: '+91-9811122201' },
    { name: 'Diya Sen', email: 'patient2@example.com', phone: '+91-9811122202' },
    { name: 'Rohan Verma', email: 'patient3@example.com', phone: '+91-9811122203' },
    { name: 'Ananya Iyer', email: 'patient4@example.com', phone: '+91-9811122204' },
    { name: 'Vikram Joshi', email: 'patient5@example.com', phone: '+91-9811122205' },
    { name: 'Neha Gupta', email: 'patient6@example.com', phone: '+91-9811122206' },
    { name: 'Kabir Singh', email: 'patient7@example.com', phone: '+91-9811122207' },
    { name: 'Pooja Nair', email: 'patient8@example.com', phone: '+91-9811122208' },
    { name: 'Arjun Reddy', email: 'patient9@example.com', phone: '+91-9811122209' },
    { name: 'Meera Kapoor', email: 'patient10@example.com', phone: '+91-9811122210' }
  ];

  const patientStmt = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, phone)
    VALUES (?, ?, ?, 'patient', ?)
  `);

  const patientIds = [];
  for (const p of patientsData) {
    const res = patientStmt.run(p.name, p.email, defaultPasswordHash, p.phone);
    patientIds.push(res.lastInsertRowid);
  }

  // Helper date generators
  const today = new Date();
  const formatYMD = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = formatYMD(today);

  // 4. Create Historical Completed Appointments across past 3 days for rich admin analytics
  const apptStmt = db.prepare(`
    INSERT INTO appointments (
      patient_id, doctor_id, token_number, token_display, status, skip_count,
      queue_position, appointment_date, created_at, called_at, started_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const docCodes = ['A', 'B', 'C'];
  const consultDurations = [7, 8, 9, 10, 11, 12, 13, 8.5, 9.5, 10.5];

  console.log('Generating realistic historical appointments for analytics...');

  // Days: -3, -2, -1
  for (let daysAgo = 3; daysAgo >= 1; daysAgo--) {
    const histDate = new Date();
    histDate.setDate(today.getDate() - daysAgo);
    const histDateStr = formatYMD(histDate);

    for (const code of docCodes) {
      const docId = doctorIds[code];
      const count = 8 + (daysAgo % 3) * 2; // 8 to 12 patients per day

      for (let tokenNum = 1; tokenNum <= count; tokenNum++) {
        const pId = patientIds[(tokenNum + daysAgo) % patientIds.length];
        const tokenDisplay = `${code}${String(tokenNum).padStart(2, '0')}`;

        // Stagger hours between 09:00 and 15:00
        const startHour = 9 + Math.floor(tokenNum * 0.5);
        const startMinute = (tokenNum * 12) % 60;
        const dur = consultDurations[(tokenNum + daysAgo) % consultDurations.length];

        const createdTime = new Date(histDate);
        createdTime.setHours(startHour - 1, (startMinute + 15) % 60, 0);

        const calledTime = new Date(histDate);
        calledTime.setHours(startHour, startMinute, 0);

        const completedTime = new Date(calledTime.getTime() + dur * 60 * 1000);

        // 1 out of 10 is no-show
        const isNoShow = tokenNum === 7;
        const status = isNoShow ? 'no_show' : 'completed';

        apptStmt.run(
          pId,
          docId,
          tokenNum,
          tokenDisplay,
          status,
          isNoShow ? 2 : 0,
          0,
          histDateStr,
          createdTime.toISOString(),
          isNoShow ? null : calledTime.toISOString(),
          isNoShow ? null : calledTime.toISOString(),
          isNoShow ? null : completedTime.toISOString()
        );
      }
    }
  }

  // 5. Seed TODAY's Live Queue for Instant Live Demos!
  console.log("Setting up today's live active queues...");

  // Doctor A (Dr. Sharma):
  // Token A01: Completed earlier today
  // Token A02: Completed earlier today
  // Token A03: Currently CALLED / In Consultation (Serving right now!)
  // Token A04: Waiting (Patient 4 - Ananya Iyer) -> You are next!
  // Token A05: Waiting (Patient 5 - Vikram Joshi)
  // Token A06: Waiting (Patient 6 - Neha Gupta) -> 3 patients away!
  // Token A07: Waiting (Patient 7 - Kabir Singh)

  const docAId = doctorIds['A'];

  // A01 Completed
  const a01Created = new Date(today.getTime() - 90 * 60 * 1000).toISOString();
  const a01Started = new Date(today.getTime() - 75 * 60 * 1000).toISOString();
  const a01Ended = new Date(today.getTime() - 63 * 60 * 1000).toISOString();
  apptStmt.run(patientIds[0], docAId, 1, 'A01', 'completed', 0, 0, todayStr, a01Created, a01Started, a01Started, a01Ended);

  // A02 Completed
  const a02Created = new Date(today.getTime() - 70 * 60 * 1000).toISOString();
  const a02Started = new Date(today.getTime() - 60 * 60 * 1000).toISOString();
  const a02Ended = new Date(today.getTime() - 48 * 60 * 1000).toISOString();
  apptStmt.run(patientIds[1], docAId, 2, 'A02', 'completed', 0, 0, todayStr, a02Created, a02Started, a02Started, a02Ended);

  // A03 Currently CALLED / IN CONSULTATION
  const a03Created = new Date(today.getTime() - 50 * 60 * 1000).toISOString();
  const a03Called = new Date(today.getTime() - 8 * 60 * 1000).toISOString();
  const a03Res = apptStmt.run(patientIds[2], docAId, 3, 'A03', 'in_consultation', 0, 0, todayStr, a03Created, a03Called, a03Called, null);
  const activeApptId = a03Res.lastInsertRowid;

  // Active queue state row for Dr. Sharma
  db.prepare(`
    INSERT INTO queue_state (doctor_id, date, is_paused, current_appointment_id)
    VALUES (?, ?, 0, ?)
  `).run(docAId, todayStr, activeApptId);

  // A04 Waiting (Position 1 in active queue)
  const a04Created = new Date(today.getTime() - 40 * 60 * 1000).toISOString();
  apptStmt.run(patientIds[3], docAId, 4, 'A04', 'waiting', 0, 1, todayStr, a04Created, null, null, null);

  // A05 Waiting (Position 2 in active queue)
  const a05Created = new Date(today.getTime() - 30 * 60 * 1000).toISOString();
  apptStmt.run(patientIds[4], docAId, 5, 'A05', 'waiting', 0, 2, todayStr, a05Created, null, null, null);

  // A06 Waiting (Position 3 in active queue)
  const a06Created = new Date(today.getTime() - 20 * 60 * 1000).toISOString();
  apptStmt.run(patientIds[5], docAId, 6, 'A06', 'waiting', 0, 3, todayStr, a06Created, null, null, null);

  // A07 Waiting (Position 4 in active queue)
  const a07Created = new Date(today.getTime() - 10 * 60 * 1000).toISOString();
  apptStmt.run(patientIds[6], docAId, 7, 'A07', 'waiting', 0, 4, todayStr, a07Created, null, null, null);

  // Doctor B (Dr. Mehta - Pediatrics)
  const docBId = doctorIds['B'];
  db.prepare(`INSERT INTO queue_state (doctor_id, date, is_paused) VALUES (?, ?, 0)`).run(docBId, todayStr);
  const b01Created = new Date(today.getTime() - 15 * 60 * 1000).toISOString();
  apptStmt.run(patientIds[7], docBId, 1, 'B01', 'waiting', 0, 1, todayStr, b01Created, null, null, null);

  // Doctor C (Dr. Khan - General Medicine)
  const docCId = doctorIds['C'];
  db.prepare(`INSERT INTO queue_state (doctor_id, date, is_paused) VALUES (?, ?, 0)`).run(docCId, todayStr);

  // Add initial notifications for patient 3, 4, 6
  const notifStmt = db.prepare(`
    INSERT INTO notifications (user_id, appointment_id, type, message, is_read, channel)
    VALUES (?, ?, ?, ?, ?, 'simulated_sms')
  `);
  notifStmt.run(patientIds[2], activeApptId, 'called', '🔔 Token A03 is CALLED! Please enter Dr. Rajesh Sharma room now.', 1);
  notifStmt.run(patientIds[3], null, 'next_in_line', 'Token A04: You are NEXT in line for Dr. Rajesh Sharma! Please stand by outside room.', 0);
  notifStmt.run(patientIds[5], null, '3_ahead', 'Token A06: You are 3 patients away from seeing Dr. Rajesh Sharma. Please start heading toward the clinic.', 0);

  console.log('✅ QueueCare database successfully seeded!');
  console.log('\n--- DEMO USER CREDENTIALS ---');
  console.log('👨‍⚕️ Admin:   admin@queuecare.com   / admin123');
  console.log('🩺 Doctor A: sharma@queuecare.com  / doctor123 (Dr. Rajesh Sharma, Cardiology)');
  console.log('🩺 Doctor B: mehta@queuecare.com   / doctor123 (Dr. Priya Mehta, Pediatrics)');
  console.log('🩺 Doctor C: khan@queuecare.com    / doctor123 (Dr. Farhan Khan, General Medicine)');
  console.log('👤 Patient:  patient4@example.com  / patient123 (Ananya Iyer - Holds Token A04)');
  console.log('👤 Patient:  patient1@example.com  / patient123 (New walk-in / booking)\n');
}

if (require.main === module) {
  runSeed();
}

module.exports = runSeed;
