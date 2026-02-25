import { Router } from 'express';
import { db } from '../db.js';
import crypto from 'crypto';

const router = Router();

router.get('/', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const users = await db.query(
    'SELECT id, email, role, parent_id, created_at, invite_token FROM users WHERE id != $1 ORDER BY created_at DESC',
    [req.user.id]
  );
  
  res.json(users);
});

router.post('/', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const { email, role } = req.body;
  
  // Check if user already exists
  const existing = await db.queryOne('SELECT id FROM users WHERE email = $1', [email]);
  if (existing) {
    return res.status(400).json({ error: 'User already exists' });
  }
  
  // Generate invite token
  const inviteToken = crypto.randomBytes(32).toString('hex');
  
  // Create user without password (will set on first login via invite link)
  // Set parent_id for viewer and editor roles so they can see admin's servers
  const parentId = role !== 'admin' ? req.user.id : null;
  await db.execute(
    'INSERT INTO users (email, password, role, parent_id, invite_token) VALUES ($1, $2, $3, $4, $5)',
    [email, '', role, parentId, inviteToken]
  );
  
  const user = await db.queryOne('SELECT id, email, role, parent_id, created_at, invite_token FROM users WHERE email = $1', [email]);
  
  res.json(user);
});

router.post('/:id/regenerate-invite', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const { id } = req.params;
  
  // Generate new invite token
  const inviteToken = crypto.randomBytes(32).toString('hex');
  
  await db.execute(
    'UPDATE users SET invite_token = $1, password = $2 WHERE id = $3',
    [inviteToken, '', id]
  );
  
  const user = await db.queryOne('SELECT id, email, role, parent_id, created_at, invite_token FROM users WHERE id = $1', [id]);
  
  res.json(user);
});

router.delete('/:id', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  await db.execute('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

export default router;
