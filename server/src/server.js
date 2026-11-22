require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const db = require('./db/database');
const setupSocketIO = require('./sockets/socketHandler');

// Route imports
const authRoutes = require('./routes/auth.routes');
const doctorsRoutes = require('./routes/doctors.routes');
const appointmentsRoutes = require('./routes/appointments.routes');
const doctorActionsRoutes = require('./routes/doctorActions.routes');
const adminRoutes = require('./routes/admin.routes');
const notificationsRoutes = require('./routes/notifications.routes');

const app = express();
const server = http.createServer(app);

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const PORT = process.env.PORT || 5001;

// Setup Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

const broadcaster = setupSocketIO(io);
app.set('socketBroadcaster', broadcaster);
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json());

// API Request Logger
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/notifications')) {
    // console.log(`[HTTP] ${req.method} ${req.path}`);
  }
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorsRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/doctor', doctorActionsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: 'QueueCare: Hospital/Clinic Waiting-Time Management',
    timestamp: new Date().toISOString()
  });
});

// Serve frontend build in production if client/dist exists
const clientDistPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(clientDistPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).send('QueueCare API is running. Client build not found at ' + clientDistPath);
    }
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack || err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

server.listen(PORT, () => {
  console.log(`\n============================================================`);
  console.log(`🏥 QueueCare Backend & Real-Time Engine Active!`);
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`⚡ WebSocket sync initialized`);
  console.log(`📁 Database: SQLite (better-sqlite3)`);
  console.log(`============================================================\n`);
});

module.exports = { app, server };
