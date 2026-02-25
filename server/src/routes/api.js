import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// API Key authentication middleware
async function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  const key = await db.queryOne('SELECT * FROM api_keys WHERE key = $1', [apiKey]);
  
  if (!key) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  req.apiUserId = key.user_id;
  next();
}

// API Key management (requires auth)
router.get('/keys', authMiddleware, async (req, res) => {
  // Viewers can't see API keys
  if (req.user.role === 'viewer') {
    return res.json([]);
  }
  
  // Editors see parent's keys, admins see their own
  const userId = req.user.parentId ? req.user.parentId : req.user.id;
  
  const keys = await db.query(
    'SELECT id, name, key, created_at FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  
  res.json(keys);
});

router.get('/keys/:id', authMiddleware, async (req, res) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const userId = req.user.parentId ? req.user.parentId : req.user.id;
  const key = await db.queryOne(
    'SELECT id, name, key, created_at FROM api_keys WHERE id = $1 AND user_id = $2',
    [req.params.id, userId]
  );
  
  if (!key) {
    return res.status(404).json({ error: 'API key not found' });
  }
  
  res.json(key);
});

router.post('/keys', authMiddleware, async (req, res) => {
  // Only admins can create API keys
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can create API keys' });
  }
  
  const { name } = req.body;
  const key = 'pk_' + crypto.randomBytes(32).toString('hex');
  
  const result = await db.execute(
    'INSERT INTO api_keys (key, name, user_id) VALUES ($1, $2, $3) RETURNING id, key, name, created_at',
    [key, name || 'API Key', req.user.id]
  );
  
  res.json(result.rows[0]);
});

router.delete('/keys/:id', authMiddleware, async (req, res) => {
  // Only admins can delete API keys
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can delete API keys' });
  }
  
  await db.execute('DELETE FROM api_keys WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  res.json({ success: true });
});

// Settings management (requires auth)
router.get('/settings', authMiddleware, async (req, res) => {
  // Use parent's settings for editors/viewers
  const userId = req.user.parentId ? req.user.parentId : req.user.id;
  const settings = await db.query('SELECT key, value FROM settings WHERE user_id = $1', [userId]);
  
  const settingsObj = {
    maxPhonesPerProxy: 3,
    scriptTemplate: ''
  };
  
  settings.forEach(s => {
    if (s.key === 'maxPhonesPerProxy') {
      settingsObj[s.key] = parseInt(s.value);
    } else {
      settingsObj[s.key] = s.value;
    }
  });
  
  res.json(settingsObj);
});

router.put('/settings', authMiddleware, async (req, res) => {
  // Only admins can change settings
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can change settings' });
  }
  
  const { maxPhonesPerProxy, scriptTemplate } = req.body;
  
  if (maxPhonesPerProxy !== undefined) {
    await db.execute(
      `INSERT INTO settings (user_id, key, value) VALUES ($1, 'maxPhonesPerProxy', $2)
       ON CONFLICT (user_id, key) DO UPDATE SET value = $2`,
      [req.user.id, String(maxPhonesPerProxy)]
    );
  }
  
  if (scriptTemplate !== undefined) {
    await db.execute(
      `INSERT INTO settings (user_id, key, value) VALUES ($1, 'scriptTemplate', $2)
       ON CONFLICT (user_id, key) DO UPDATE SET value = $2`,
      [req.user.id, scriptTemplate]
    );
  }
  
  res.json({ success: true });
});

// Normalize phone number
function normalizePhone(phone) {
  if (!phone) return phone;
  
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Check if it's an Israeli number
  const isIsraeli = (
    cleaned.startsWith('+972') ||
    cleaned.startsWith('972') ||
    cleaned.startsWith('05') ||
    cleaned.startsWith('02') ||
    cleaned.startsWith('03') ||
    cleaned.startsWith('04') ||
    cleaned.startsWith('07') ||
    cleaned.startsWith('08') ||
    cleaned.startsWith('09')
  );
  
  if (isIsraeli) {
    // Remove + if exists
    cleaned = cleaned.replace(/^\+/, '');
    
    // If starts with 0, replace with 972
    if (cleaned.startsWith('0')) {
      cleaned = '972' + cleaned.substring(1);
    }
    
    // If doesn't start with 972, add it
    if (!cleaned.startsWith('972')) {
      cleaned = '972' + cleaned;
    }
  } else {
    // For non-Israeli numbers, just clean (remove + and spaces)
    cleaned = cleaned.replace(/^\+/, '');
  }
  
  return cleaned;
}

// Helper to get available proxy
async function getAvailableProxy(userId) {
  const setting = await db.queryOne(
    "SELECT value FROM settings WHERE user_id = $1 AND key = 'maxPhonesPerProxy'",
    [userId]
  );
  const maxPhones = setting ? parseInt(setting.value) : 3;
  
  const proxy = await db.queryOne(
    `SELECT p.id, p.ip, p.port FROM proxy_ips p
     JOIN servers s ON p.server_id = s.id
     WHERE s.user_id = $1
     AND (SELECT COUNT(*) FROM phone_numbers WHERE proxy_id = p.id) < $2
     ORDER BY (SELECT COUNT(*) FROM phone_numbers WHERE proxy_id = p.id) ASC
     LIMIT 1`,
    [userId, maxPhones]
  );
  
  return proxy;
}

// External API endpoints (requires API key)
router.post('/phone/assign', apiKeyAuth, async (req, res) => {
  const { phone, proxyIp, port } = req.body;
  
  if (!phone) {
    return res.status(400).json({ error: 'phone is required' });
  }
  
  const normalizedPhone = normalizePhone(phone);
  let proxy;
  
  if (proxyIp) {
    // Find specific proxy
    let query = `
      SELECT p.* FROM proxy_ips p
      JOIN servers s ON p.server_id = s.id
      WHERE p.ip = $1 AND s.user_id = $2
    `;
    let params = [proxyIp, req.apiUserId];
    
    if (port) {
      query += ' AND p.port = $3';
      params.push(port);
    }
    
    proxy = await db.queryOne(query, params);
    
    if (!proxy) {
      return res.status(404).json({ error: 'Proxy not found' });
    }
  } else {
    // Auto-assign to available proxy
    proxy = await getAvailableProxy(req.apiUserId);
    
    if (!proxy) {
      return res.status(400).json({ error: 'No available proxy found' });
    }
  }
  
  // Check if phone already assigned to this proxy
  const existing = await db.queryOne(
    'SELECT * FROM phone_numbers WHERE phone = $1 AND proxy_id = $2',
    [normalizedPhone, proxy.id]
  );
  
  if (existing) {
    return res.json({ 
      success: true, 
      message: 'Phone already assigned', 
      proxyId: proxy.id,
      proxy: `${proxy.ip}:${proxy.port}`,
      phone: normalizedPhone
    });
  }
  
  await db.execute('INSERT INTO phone_numbers (phone, proxy_id) VALUES ($1, $2)', [normalizedPhone, proxy.id]);
  
  res.json({ 
    success: true, 
    proxyId: proxy.id,
    proxy: `${proxy.ip}:${proxy.port}`,
    phone: normalizedPhone
  });
});

router.post('/phone/remove', apiKeyAuth, async (req, res) => {
  const { phone, proxyIp } = req.body;
  
  if (!phone) {
    return res.status(400).json({ error: 'phone is required' });
  }
  
  const normalizedPhone = normalizePhone(phone);
  
  if (proxyIp) {
    // Remove from specific proxy
    const proxy = await db.queryOne(
      `SELECT p.* FROM proxy_ips p
       JOIN servers s ON p.server_id = s.id
       WHERE p.ip = $1 AND s.user_id = $2`,
      [proxyIp, req.apiUserId]
    );
    
    if (proxy) {
      await db.execute('DELETE FROM phone_numbers WHERE phone = $1 AND proxy_id = $2', [normalizedPhone, proxy.id]);
    }
  } else {
    // Remove from all proxies owned by this user
    await db.execute(
      `DELETE FROM phone_numbers WHERE phone = $1 AND proxy_id IN (
        SELECT p.id FROM proxy_ips p
        JOIN servers s ON p.server_id = s.id
        WHERE s.user_id = $2
      )`,
      [normalizedPhone, req.apiUserId]
    );
  }
  
  res.json({ success: true, phone: normalizedPhone });
});

// Get single available proxy
router.get('/proxy/available', apiKeyAuth, async (req, res) => {
  const proxy = await getAvailableProxy(req.apiUserId);
  
  if (!proxy) {
    return res.status(404).json({ error: 'No available proxy found' });
  }
  
  const phoneCount = await db.queryOne(
    'SELECT COUNT(*) as count FROM phone_numbers WHERE proxy_id = $1',
    [proxy.id]
  );
  
  res.json({
    id: proxy.id,
    proxy: `${proxy.ip}:${proxy.port}`,
    ip: proxy.ip,
    port: proxy.port,
    phoneCount: parseInt(phoneCount.count)
  });
});

// Get all available proxies
router.get('/proxies/available', apiKeyAuth, async (req, res) => {
  // Get user's maxPhonesPerProxy setting
  const setting = await db.queryOne(
    "SELECT value FROM settings WHERE user_id = $1 AND key = 'maxPhonesPerProxy'",
    [req.apiUserId]
  );
  
  const maxPhones = setting ? parseInt(setting.value) : 3;
  
  // Find proxies with fewer than maxPhones assigned
  const availableProxies = await db.query(
    `SELECT p.id, p.ip, p.port, s.name as server_name,
            (SELECT COUNT(*) FROM phone_numbers WHERE proxy_id = p.id) as phone_count
     FROM proxy_ips p
     JOIN servers s ON p.server_id = s.id
     WHERE s.user_id = $1
     GROUP BY p.id, p.ip, p.port, s.name
     HAVING (SELECT COUNT(*) FROM phone_numbers WHERE proxy_id = p.id) < $2
     ORDER BY phone_count ASC`,
    [req.apiUserId, maxPhones]
  );
  
  res.json({
    maxPhonesPerProxy: maxPhones,
    available: availableProxies.map(p => ({
      id: p.id,
      proxy: `${p.ip}:${p.port}`,
      ip: p.ip,
      port: p.port,
      serverName: p.server_name,
      phoneCount: parseInt(p.phone_count)
    }))
  });
});

router.get('/proxies/all', apiKeyAuth, async (req, res) => {
  const proxies = await db.query(
    `SELECT p.id, p.ip, p.port, s.name as server_name
     FROM proxy_ips p
     JOIN servers s ON p.server_id = s.id
     WHERE s.user_id = $1
     ORDER BY s.name, p.port`,
    [req.apiUserId]
  );
  
  const result = await Promise.all(proxies.map(async (proxy) => {
    const phones = await db.query('SELECT phone FROM phone_numbers WHERE proxy_id = $1', [proxy.id]);
    return {
      id: proxy.id,
      proxy: `${proxy.ip}:${proxy.port}`,
      ip: proxy.ip,
      port: proxy.port,
      serverName: proxy.server_name,
      phones: phones.map(p => p.phone)
    };
  }));
  
  res.json(result);
});

export default router;
