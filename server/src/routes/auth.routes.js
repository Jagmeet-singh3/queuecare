const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { JWT_SECRET, verifyToken } = require('../middleware/auth.middleware');

/**
 * POST /api/auth/register
 * Registers a new patient.
 */
router.post('/register', (req, res) => {
  const { name, email, password, phone } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  // Check if email already exists
  const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email.toLowerCase().trim());
  if (existing) {
    return res.status(400).json({ error: 'An account with this email already exists' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const stmt = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, phone)
    VALUES (?, ?, ?, 'patient', ?)
  `);

  try {
    const info = stmt.run(name.trim(), email.toLowerCase().trim(), passwordHash, phone || null);
    const userId = info.lastInsertRowid;

    const token = jwt.sign(
      { id: userId, email: email.toLowerCase().trim(), name: name.trim(), role: 'patient' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'Registration successful',
      token,
      user: { id: userId, name: name.trim(), email: email.toLowerCase().trim(), role: 'patient', phone: phone || null }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create user account: ' + err.message });
  }
});

/**
 * POST /api/auth/login
 * Role-based login (patient, doctor, admin)
 */
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email.toLowerCase().trim());
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const isMatch = bcrypt.compareSync(password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // If role is doctor, find corresponding doctorId
  let doctorId = null;
  if (user.role === 'doctor') {
    const doc = db.prepare(`SELECT id FROM doctors WHERE user_id = ?`).get(user.id);
    doctorId = doc ? doc.id : null;
  }

  const tokenPayload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    doctorId
  };

  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

  return res.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      doctorId
    }
  });
});

/**
 * GET /api/auth/me
 * Retrieves active session user
 */
router.get('/me', verifyToken, (req, res) => {
  const user = db.prepare(`SELECT id, name, email, role, phone FROM users WHERE id = ?`).get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  let doctorId = null;
  if (user.role === 'doctor') {
    const doc = db.prepare(`SELECT id FROM doctors WHERE user_id = ?`).get(user.id);
    doctorId = doc ? doc.id : null;
  }

  return res.json({
    user: {
      ...user,
      doctorId
    }
  });
});

module.exports = router;
