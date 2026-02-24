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
  const keys = await db.query(
    'SELECT id, name, key, created_at FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC',
    [req.user.id]
  );
  
  // Mask the keys for display
  const maskedKeys = keys.map(k => ({
    ...k,
    key: k.key.substring(0, 8) + '...' + k.key.substring(k.key.length - 4)
  }));
  
  res.json(maskedKeys);
});

router.post('/keys', authMiddleware, async (req, res) => {
  const { name } = req.body;
  const key = 'pk_' + crypto.randomBytes(32).toString('hex');
  
  const result = await db.execute(
    'INSERT INTO api_keys (key, name, user_id) VALUES ($1, $2, $3) RETURNING id',
    [key, name || 'API Key', req.user.id]
  );
  
  res.json({ id: result.rows[0].id, key, name });
});

router.delete('/keys/:id', authMiddleware, async (req, res) => {
  await db.execute('DELETE FROM api_keys WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  res.json({ success: true });
});

// Settings management (requires auth)
router.get('/settings', authMiddleware, async (req, res) => {
  const settings = await db.query('SELECT key, value FROM settings WHERE user_id = $1', [req.user.id]);
  
  const settingsObj = {
    maxPhonesPerProxy: 3 // default
  };
  
  settings.forEach(s => {
    settingsObj[s.key] = s.value;
  });
  
  res.json(settingsObj);
});

router.put('/settings', authMiddleware, async (req, res) => {
  const { maxPhonesPerProxy } = req.body;
  
  await db.execute(
    `INSERT INTO settings (user_id, key, value) VALUES ($1, 'maxPhonesPerProxy', $2)
     ON CONFLICT (user_id, key) DO UPDATE SET value = $2`,
    [req.user.id, String(maxPhonesPerProxy)]
  );
  
  res.json({ success: true });
});

// External API endpoints (requires API key)
router.post('/phone/assign', apiKeyAuth, async (req, res) => {
  const { phone, proxyIp, port } = req.body;
  
  if (!phone || !proxyIp) {
    return res.status(400).json({ error: 'phone and proxyIp are required' });
  }
  
  // Find the proxy by IP (and port if provided)
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
  
  const proxy = await db.queryOne(query, params);
  
  if (!proxy) {
    return res.status(404).json({ error: 'Proxy not found' });
  }
  
  // Check if phone already assigned to this proxy
  const existing = await db.queryOne(
    'SELECT * FROM phone_numbers WHERE phone = $1 AND proxy_id = $2',
    [phone, proxy.id]
  );
  
  if (existing) {
    return res.json({ success: true, message: 'Phone already assigned', proxyId: proxy.id });
  }
  
  await db.execute('INSERT INTO phone_numbers (phone, proxy_id) VALUES ($1, $2)', [phone, proxy.id]);
  
  res.json({ success: true, proxyId: proxy.id });
});

router.post('/phone/remove', apiKeyAuth, async (req, res) => {
  const { phone, proxyIp } = req.body;
  
  if (!phone) {
    return res.status(400).json({ error: 'phone is required' });
  }
  
  if (proxyIp) {
    // Remove from specific proxy
    const proxy = await db.queryOne(
      `SELECT p.* FROM proxy_ips p
       JOIN servers s ON p.server_id = s.id
       WHERE p.ip = $1 AND s.user_id = $2`,
      [proxyIp, req.apiUserId]
    );
    
    if (proxy) {
      await db.execute('DELETE FROM phone_numbers WHERE phone = $1 AND proxy_id = $2', [phone, proxy.id]);
    }
  } else {
    // Remove from all proxies owned by this user
    await db.execute(
      `DELETE FROM phone_numbers WHERE phone = $1 AND proxy_id IN (
        SELECT p.id FROM proxy_ips p
        JOIN servers s ON p.server_id = s.id
        WHERE s.user_id = $2
      )`,
      [phone, req.apiUserId]
    );
  }
  
  res.json({ success: true });
});

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
