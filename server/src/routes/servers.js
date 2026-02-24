import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const userId = req.user.role === 'viewer' && req.user.parentId 
    ? req.user.parentId 
    : req.user.id;
  
  const servers = db.prepare(`
    SELECT * FROM servers WHERE user_id = ? ORDER BY created_at DESC
  `).all(userId);
  
  const result = servers.map(server => ({
    ...server,
    proxyIps: db.prepare('SELECT * FROM proxy_ips WHERE server_id = ? ORDER BY port').all(server.id)
  }));
  
  res.json(result);
});

router.post('/', (req, res) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const { name, mainIp, proxyIps } = req.body;
  
  const result = db.prepare('INSERT INTO servers (name, main_ip, user_id) VALUES (?, ?, ?)')
    .run(name, mainIp, req.user.id);
  
  const serverId = result.lastInsertRowid;
  
  proxyIps.forEach((ip, index) => {
    db.prepare('INSERT INTO proxy_ips (ip, port, server_id) VALUES (?, ?, ?)')
      .run(ip, 8080 + index, serverId);
  });
  
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
  server.proxyIps = db.prepare('SELECT * FROM proxy_ips WHERE server_id = ?').all(serverId);
  
  res.json(server);
});

router.put('/:id', (req, res) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const { id } = req.params;
  const { name, mainIp, proxyIps } = req.body;
  
  db.prepare('UPDATE servers SET name = ?, main_ip = ? WHERE id = ?').run(name, mainIp, id);
  db.prepare('DELETE FROM proxy_ips WHERE server_id = ?').run(id);
  
  proxyIps.forEach((ip, index) => {
    db.prepare('INSERT INTO proxy_ips (ip, port, server_id) VALUES (?, ?, ?)')
      .run(ip, 8080 + index, id);
  });
  
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(id);
  server.proxyIps = db.prepare('SELECT * FROM proxy_ips WHERE server_id = ?').all(id);
  
  res.json(server);
});

router.delete('/:id', (req, res) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  db.prepare('DELETE FROM servers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.get('/:id/script', (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  
  if (!server) {
    return res.status(404).json({ error: 'Server not found' });
  }
  
  const proxyIps = db.prepare('SELECT * FROM proxy_ips WHERE server_id = ? ORDER BY port').all(server.id);
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
