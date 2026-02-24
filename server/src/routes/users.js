import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../db.js';
import { sendNewUserEmail } from '../mail.js';

const router = Router();

router.get('/', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const users = await db.query(
    'SELECT id, email, name, role, parent_id, created_at FROM users WHERE id != $1 ORDER BY created_at DESC',
    [req.user.id]
  );
  
  res.json(users);
});

router.post('/', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const { email, name, role, parentId } = req.body;
  
  const existing = await db.queryOne('SELECT * FROM users WHERE email = $1', [email]);
  if (existing) {
    return res.status(400).json({ error: 'User already exists' });
  }
  
  const tempPassword = crypto.randomBytes(8).toString('hex');
  const hashedPassword = await bcrypt.hash(tempPassword, 12);
  
  const result = await db.execute(
    'INSERT INTO users (email, name, password, role, parent_id, password_setup) VALUES ($1, $2, $3, $4, $5, true) RETURNING id',
    [email, name || null, hashedPassword, role || 'viewer', parentId || null]
  );
  
  try {
    await sendNewUserEmail(email, tempPassword);
  } catch (error) {
    console.error('Failed to send email:', error);
  }
  
  const user = await db.queryOne(
    'SELECT id, email, name, role, parent_id, created_at FROM users WHERE id = $1',
    [result.rows[0].id]
  );
  
  res.json({ ...user, tempPassword });
});

router.delete('/:id', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  await db.execute('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

export default router;
