import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  const userId = req.user.role === 'viewer' && req.user.parentId 
    ? req.user.parentId 
    : req.user.id;
  
  const servers = await db.query(
    'SELECT * FROM servers WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  
  const result = await Promise.all(servers.map(async (server) => {
    const proxyIps = await db.query(
      'SELECT * FROM proxy_ips WHERE server_id = $1 ORDER BY port',
      [server.id]
    );
    
    const proxyIpsWithPhones = await Promise.all(proxyIps.map(async (proxy) => {
      const phones = await db.query(
        'SELECT * FROM phone_numbers WHERE proxy_id = $1 ORDER BY created_at',
        [proxy.id]
      );
      return { ...proxy, phones };
    }));
    
    return { ...server, proxyIps: proxyIpsWithPhones };
  }));
  
  res.json(result);
});

router.post('/', async (req, res) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const { name, mainIp, proxyIps } = req.body;
  
  const result = await db.execute(
    'INSERT INTO servers (name, main_ip, user_id) VALUES ($1, $2, $3) RETURNING id',
    [name, mainIp, req.user.id]
  );
  
  const serverId = result.rows[0].id;
  
  for (let i = 0; i < proxyIps.length; i++) {
    await db.execute(
      'INSERT INTO proxy_ips (ip, port, server_id) VALUES ($1, $2, $3)',
      [proxyIps[i], 8080 + i, serverId]
    );
  }
  
  const server = await db.queryOne('SELECT * FROM servers WHERE id = $1', [serverId]);
  const ips = await db.query('SELECT * FROM proxy_ips WHERE server_id = $1', [serverId]);
  server.proxyIps = ips.map(ip => ({ ...ip, phones: [] }));
  
  res.json(server);
});

router.put('/:id', async (req, res) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const { id } = req.params;
  const { name, mainIp, proxyIps } = req.body;
  
  await db.execute('UPDATE servers SET name = $1, main_ip = $2 WHERE id = $3', [name, mainIp, id]);
  await db.execute('DELETE FROM proxy_ips WHERE server_id = $1', [id]);
  
  for (let i = 0; i < proxyIps.length; i++) {
    await db.execute(
      'INSERT INTO proxy_ips (ip, port, server_id) VALUES ($1, $2, $3)',
      [proxyIps[i], 8080 + i, id]
    );
  }
  
  const server = await db.queryOne('SELECT * FROM servers WHERE id = $1', [id]);
  const ips = await db.query('SELECT * FROM proxy_ips WHERE server_id = $1', [id]);
  server.proxyIps = ips.map(ip => ({ ...ip, phones: [] }));
  
  res.json(server);
});

router.delete('/:id', async (req, res) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  await db.execute('DELETE FROM servers WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

// Phone number management
router.post('/proxy/:proxyId/phones', async (req, res) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const { proxyId } = req.params;
  const { phone } = req.body;
  
  await db.execute(
    'INSERT INTO phone_numbers (phone, proxy_id) VALUES ($1, $2)',
    [phone, proxyId]
  );
  
  const phones = await db.query('SELECT * FROM phone_numbers WHERE proxy_id = $1', [proxyId]);
  res.json(phones);
});

router.delete('/proxy/:proxyId/phones/:phoneId', async (req, res) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  await db.execute('DELETE FROM phone_numbers WHERE id = $1', [req.params.phoneId]);
  res.json({ success: true });
});

router.get('/:id/script', async (req, res) => {
  const server = await db.queryOne('SELECT * FROM servers WHERE id = $1', [req.params.id]);
  
  if (!server) {
    return res.status(404).json({ error: 'Server not found' });
  }
  
  const proxyIps = await db.query(
    'SELECT * FROM proxy_ips WHERE server_id = $1 ORDER BY port',
    [server.id]
  );
  const ips = proxyIps.map(p => p.ip);
  const ipsString = ips.map(ip => `"${ip}"`).join(' ');
  
  const script = generateScript(server.name, ipsString);
  
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="setup-${server.name.replace(/\s+/g, '-')}.sh"`);
  res.send(script);
});

function generateScript(serverName, ipsString) {
  return `#!/bin/bash
# --- סקריפט התקנה אוטומטי עבור שרת: ${serverName} ---
# --- נוצר אוטומטית על ידי מערכת ניהול פרוקסי ---

# --- הגדרת ה-IPs ---
IPS=(${ipsString})

# --- תחילת הסקריפט האוטומטי ---
sudo bash -c '
set -e
echo "🚀 מתחיל תהליך הקמה דינאמי הכולל Firewall..."

# 1. זיהוי נתוני רשת
INTERFACE=$(ip -o -4 route show to default | awk "{print \\$5}")
GATEWAY=$(ip route | grep default | awk "{print \\$3}")
echo "📡 מזוהה ממשק: $INTERFACE, Gateway: $GATEWAY"

# 2. עדכון Netplan
echo "⚙️ מעדכן הגדרות רשת (Netplan)..."
NETPLAN_FILE="/etc/netplan/50-cloud-init.yaml"
[ -f $NETPLAN_FILE ] && cp $NETPLAN_FILE "\${NETPLAN_FILE}.bak"

cat <<NETPLAN > $NETPLAN_FILE
network:
    version: 2
    ethernets:
        $INTERFACE:
            addresses:
NETPLAN

for ip in "\${IPS[@]}"; do
    echo "            - $ip/32" >> $NETPLAN_FILE
done

cat <<NETPLAN >> $NETPLAN_FILE
            routes:
                - to: default
                  via: $GATEWAY
            nameservers:
                addresses: [8.8.8.8, 1.1.1.1]
NETPLAN

netplan apply
sleep 2

# 3. התקנה וניקוי
apt update && apt install tinyproxy curl -y
killall -9 tinyproxy 2>/dev/null || true
mkdir -p /etc/tinyproxy/instances /var/log/tinyproxy /run/tinyproxy
chown -R tinyproxy:tinyproxy /var/log/tinyproxy /run/tinyproxy

# 4. הגדרת Firewall
echo "🛡️ מעדכן חומת אש (UFW)..."
ufw allow ssh || true
PORT=8080
for ip in "\${IPS[@]}"; do
    ufw allow $PORT/tcp >> /dev/null
    PORT=$((PORT + 1))
done
echo "y" | ufw enable || true

# 5. יצירת מופעים
echo "🛠️ מקים מופעי פרוקסי..."
PORT=8080
START_SCRIPT="/usr/local/bin/start-proxies.sh"
echo "#!/bin/bash" > $START_SCRIPT
echo "killall -9 tinyproxy 2>/dev/null" >> $START_SCRIPT

for ip in "\${IPS[@]}"; do
    CONF="/etc/tinyproxy/instances/p\${PORT}.conf"
    cat <<CONF > $CONF
User tinyproxy
Group tinyproxy
Port $PORT
Listen 0.0.0.0
Bind $ip
Timeout 600
MaxClients 100
Allow 0.0.0.0/0
DisableViaHeader Yes
ConnectPort 443
ConnectPort 5222
PidFile "/run/tinyproxy/p\${PORT}.pid"
LogFile "/var/log/tinyproxy/p\${PORT}.log"
Anonymous "Host"
Anonymous "Authorization"
Anonymous "User-Agent"
CONF
    echo "tinyproxy -c $CONF" >> $START_SCRIPT
    PORT=$((PORT + 1))
done

# 6. הגדרת שירות מערכת
chmod +x $START_SCRIPT
cat <<SERVICE > /etc/systemd/system/proxy-farm.service
[Unit]
Description=Dynamic Proxy Farm
After=network.target

[Service]
Type=forking
ExecStart=$START_SCRIPT
Restart=always

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable proxy-farm.service
systemctl start proxy-farm.service
sleep 2

# 7. בדיקה סופית
echo "--- 🔍 מבצע בדיקת תקינות סופית ---"
PORT=8080
for ip in "\${IPS[@]}"; do
    RESULT=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 -x http://localhost:$PORT http://www.google.com || echo "FAILED")
    if [ "$RESULT" == "200" ]; then
        echo "✅ Port $PORT ($ip): עובד!"
    else
        echo "❌ Port $PORT ($ip): נכשל"
    fi
    PORT=$((PORT + 1))
done

echo "--- ✨ הסקריפט הסתיים! ---"
'
`;
}

export default router;
