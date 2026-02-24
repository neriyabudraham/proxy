import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../db.js';
import { sendNewUserEmail } from '../mail.js';

const router = Router();

router.get('/', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const users = db.prepare(`
    SELECT id, email, name, role, parent_id, created_at 
    FROM users WHERE id != ? ORDER BY created_at DESC
  `).all(req.user.id);
  
  res.json(users);
});

router.post('/', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const { email, name, role, parentId } = req.body;
  
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(400).json({ error: 'User already exists' });
  }
  
  const tempPassword = crypto.randomBytes(8).toString('hex');
  const hashedPassword = await bcrypt.hash(tempPassword, 12);
  
  const result = db.prepare(`
    INSERT INTO users (email, name, password, role, parent_id, password_setup) 
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(email, name || null, hashedPassword, role || 'viewer', parentId || null);
  
  try {
    await sendNewUserEmail(email, tempPassword);
  } catch (error) {
    console.error('Failed to send email:', error);
  }
  
  const user = db.prepare('SELECT id, email, name, role, parent_id, created_at FROM users WHERE id = ?')
    .get(result.lastInsertRowid);
  
  res.json({ ...user, tempPassword });
});

router.delete('/:id', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
