import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { db } from '../db.js';
import { generateToken } from '../middleware/auth.js';
import { sendPasswordResetEmail } from '../mail.js';

const router = Router();
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'office@neriyabudraham.co.il';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.get('/check-setup', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(ADMIN_EMAIL);
  res.json({ needsSetup: !user || !user.password_setup });
});

router.post('/setup-password', async (req, res) => {
  const { password } = req.body;
  
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  
  const hashedPassword = await bcrypt.hash(password, 12);
  
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(ADMIN_EMAIL);
  
  if (existing) {
    db.prepare('UPDATE users SET password = ?, password_setup = 1, role = ? WHERE email = ?')
      .run(hashedPassword, 'admin', ADMIN_EMAIL);
  } else {
    db.prepare('INSERT INTO users (email, password, role, password_setup) VALUES (?, ?, ?, 1)')
      .run(ADMIN_EMAIL, hashedPassword, 'admin');
  }
  
  res.json({ success: true });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  
  if (!user || !user.password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const valid = await bcrypt.compare(password, user.password);
  
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = generateToken(user);
  
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  
  res.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role }
  });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

router.get('/me', (req, res) => {
  const token = req.cookies.token;
  
  if (!token) {
    return res.json({ user: null });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, email, name, role, parent_id FROM users WHERE id = ?').get(decoded.id);
    res.json({ user });
  } catch {
    res.json({ user: null });
  }
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  
  if (!user) {
    return res.json({ success: true });
  }
  
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  
  db.prepare('INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)')
    .run(email, token, expiresAt);
  
  try {
    await sendPasswordResetEmail(email, token);
  } catch (error) {
    console.error('Failed to send email:', error);
  }
  
  res.json({ success: true });
});

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  
  const reset = db.prepare('SELECT * FROM password_resets WHERE token = ? AND expires_at > ?')
    .get(token, new Date().toISOString());
  
  if (!reset) {
    return res.status(400).json({ error: 'Invalid or expired token' });
  }
  
  const hashedPassword = await bcrypt.hash(password, 12);
  
  db.prepare('UPDATE users SET password = ?, password_setup = 1 WHERE email = ?')
    .run(hashedPassword, reset.email);
  
  db.prepare('DELETE FROM password_resets WHERE id = ?').run(reset.id);
  
  res.json({ success: true });
});

router.post('/google', async (req, res) => {
  const { credential } = req.body;
  
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    const email = payload.email;
    
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    
    if (!user) {
      if (email === ADMIN_EMAIL) {
        db.prepare('INSERT INTO users (email, name, role, password_setup) VALUES (?, ?, ?, 1)')
          .run(email, payload.name, 'admin');
        user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      } else {
        return res.status(403).json({ error: 'User not authorized' });
      }
    }
    
    const token = generateToken(user);
    
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    
    res.json({
      user: { id: user.id, email: user.email, name: user.name || payload.name, role: user.role }
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(401).json({ error: 'Invalid Google token' });
  }
});

router.get('/google-client-id', (req, res) => {
  res.json({ clientId: process.env.GOOGLE_CLIENT_ID || '' });
});

export default router;
