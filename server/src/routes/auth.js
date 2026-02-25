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

router.get('/check-setup', async (req, res) => {
  const user = await db.queryOne('SELECT * FROM users WHERE email = $1', [ADMIN_EMAIL]);
  res.json({ needsSetup: !user || !user.password_setup });
});

router.post('/setup-password', async (req, res) => {
  const { password } = req.body;
  
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  
  const hashedPassword = await bcrypt.hash(password, 12);
  
  const existing = await db.queryOne('SELECT * FROM users WHERE email = $1', [ADMIN_EMAIL]);
  
  if (existing) {
    await db.execute('UPDATE users SET password = $1, password_setup = true, role = $2 WHERE email = $3',
      [hashedPassword, 'admin', ADMIN_EMAIL]);
  } else {
    await db.execute('INSERT INTO users (email, password, role, password_setup) VALUES ($1, $2, $3, true)',
      [ADMIN_EMAIL, hashedPassword, 'admin']);
  }
  
  res.json({ success: true });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  const user = await db.queryOne('SELECT * FROM users WHERE email = $1', [email]);
  
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

router.get('/me', async (req, res) => {
  const token = req.cookies.token;
  
  if (!token) {
    return res.json({ user: null });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.queryOne('SELECT id, email, name, role, parent_id FROM users WHERE id = $1', [decoded.id]);
    res.json({ user });
  } catch {
    res.json({ user: null });
  }
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  
  const user = await db.queryOne('SELECT * FROM users WHERE email = $1', [email]);
  
  if (!user) {
    return res.json({ success: true });
  }
  
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  
  await db.execute('INSERT INTO password_resets (email, token, expires_at) VALUES ($1, $2, $3)',
    [email, token, expiresAt]);
  
  try {
    await sendPasswordResetEmail(email, token);
  } catch (error) {
    console.error('Failed to send email:', error);
  }
  
  res.json({ success: true });
});

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  
  const reset = await db.queryOne(
    'SELECT * FROM password_resets WHERE token = $1 AND expires_at > $2',
    [token, new Date()]
  );
  
  if (!reset) {
    return res.status(400).json({ error: 'Invalid or expired token' });
  }
  
  const hashedPassword = await bcrypt.hash(password, 12);
  
  await db.execute('UPDATE users SET password = $1, password_setup = true WHERE email = $2',
    [hashedPassword, reset.email]);
  
  await db.execute('DELETE FROM password_resets WHERE id = $1', [reset.id]);
  
  res.json({ success: true });
});

// Invite token verification
router.get('/verify-invite/:token', async (req, res) => {
  const { token } = req.params;
  
  const user = await db.queryOne('SELECT id, email, role FROM users WHERE invite_token = $1', [token]);
  
  if (!user) {
    return res.status(404).json({ error: 'Invalid or expired invite link' });
  }
  
  res.json({ email: user.email, role: user.role });
});

// Complete registration via invite
router.post('/complete-invite', async (req, res) => {
  const { token, password, name } = req.body;
  
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  
  const user = await db.queryOne('SELECT * FROM users WHERE invite_token = $1', [token]);
  
  if (!user) {
    return res.status(404).json({ error: 'Invalid or expired invite link' });
  }
  
  const hashedPassword = await bcrypt.hash(password, 12);
  
  await db.execute(
    'UPDATE users SET password = $1, name = $2, password_setup = true, invite_token = NULL WHERE id = $3',
    [hashedPassword, name || '', user.id]
  );
  
  const updatedUser = await db.queryOne('SELECT * FROM users WHERE id = $1', [user.id]);
  const authToken = generateToken(updatedUser);
  
  res.cookie('token', authToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  
  res.json({
    success: true,
    user: { id: updatedUser.id, email: updatedUser.email, name: updatedUser.name, role: updatedUser.role }
  });
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
    
    let user = await db.queryOne('SELECT * FROM users WHERE email = $1', [email]);
    
    if (!user) {
      if (email === ADMIN_EMAIL) {
        await db.execute('INSERT INTO users (email, name, role, password_setup) VALUES ($1, $2, $3, true)',
          [email, payload.name, 'admin']);
        user = await db.queryOne('SELECT * FROM users WHERE email = $1', [email]);
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

router.get('/google/redirect', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${process.env.CLIENT_URL}/api/auth/callback/google`;
  const scope = 'openid email profile';
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scope)}` +
    `&access_type=offline` +
    `&prompt=select_account`;
  
  res.redirect(authUrl);
});

router.get('/callback/google', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.redirect('/login?error=no_code');
  }
  
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${process.env.CLIENT_URL}/api/auth/callback/google`,
        grant_type: 'authorization_code'
      })
    });
    
    const tokens = await tokenRes.json();
    
    if (!tokens.id_token) {
      return res.redirect('/login?error=no_token');
    }
    
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    const email = payload.email;
    
    let user = await db.queryOne('SELECT * FROM users WHERE email = $1', [email]);
    
    if (!user) {
      if (email === ADMIN_EMAIL) {
        await db.execute('INSERT INTO users (email, name, role, password_setup) VALUES ($1, $2, $3, true)',
          [email, payload.name, 'admin']);
        user = await db.queryOne('SELECT * FROM users WHERE email = $1', [email]);
      } else {
        return res.redirect('/login?error=unauthorized');
      }
    }
    
    const token = generateToken(user);
    
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Google callback error:', error);
    res.redirect('/login?error=auth_failed');
  }
});

export default router;
