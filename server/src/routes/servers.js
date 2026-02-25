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
  
  const { name, mainIp } = req.body;
  
  const result = await db.execute(
    'INSERT INTO servers (name, main_ip, user_id) VALUES ($1, $2, $3) RETURNING id',
    [name, mainIp, req.user.id]
  );
  
  const serverId = result.rows[0].id;
  const server = await db.queryOne('SELECT * FROM servers WHERE id = $1', [serverId]);
  server.proxyIps = [];
  
  res.json(server);
});

router.put('/:id', async (req, res) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const { id } = req.params;
  const { name, mainIp } = req.body;
  
  await db.execute('UPDATE servers SET name = $1, main_ip = $2 WHERE id = $3', [name, mainIp, id]);
  
  const server = await db.queryOne('SELECT * FROM servers WHERE id = $1', [id]);
  const ips = await db.query('SELECT * FROM proxy_ips WHERE server_id = $1 ORDER BY port', [id]);
  server.proxyIps = await Promise.all(ips.map(async (proxy) => {
    const phones = await db.query('SELECT * FROM phone_numbers WHERE proxy_id = $1', [proxy.id]);
    return { ...proxy, phones };
  }));
  
  res.json(server);
});

router.delete('/:id', async (req, res) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  await db.execute('DELETE FROM servers WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

// Proxy IP management
router.post('/:serverId/proxies', async (req, res) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const { serverId } = req.params;
  const { ip, port } = req.body;
  
  // If port not specified, find next available
  let assignedPort = port;
  if (!assignedPort) {
    const maxPort = await db.queryOne(
      'SELECT COALESCE(MAX(port), 8079) as max_port FROM proxy_ips WHERE server_id = $1',
      [serverId]
    );
    assignedPort = maxPort.max_port + 1;
  }
  
  const result = await db.execute(
    'INSERT INTO proxy_ips (ip, port, server_id) VALUES ($1, $2, $3) RETURNING *',
    [ip, assignedPort, serverId]
  );
  
  res.json({ ...result.rows[0], phones: [] });
});

router.put('/:serverId/proxies/:proxyId', async (req, res) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const { proxyId } = req.params;
  const { ip, port } = req.body;
  
  await db.execute('UPDATE proxy_ips SET ip = $1, port = $2 WHERE id = $3', [ip, port, proxyId]);
  
  const proxy = await db.queryOne('SELECT * FROM proxy_ips WHERE id = $1', [proxyId]);
  const phones = await db.query('SELECT * FROM phone_numbers WHERE proxy_id = $1', [proxyId]);
  
  res.json({ ...proxy, phones });
});

router.delete('/:serverId/proxies/:proxyId', async (req, res) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  await db.execute('DELETE FROM proxy_ips WHERE id = $1', [req.params.proxyId]);
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
  
  if (proxyIps.length === 0) {
    return res.status(400).json({ error: 'No proxy IPs configured' });
  }
  
  const script = generateScript(server.name, proxyIps);
  
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="setup-${server.name.replace(/\s+/g, '-')}.sh"`);
  res.send(script);
});

function generateScript(serverName, proxyIps) {
  const ipsArray = proxyIps.map(p => `"${p.ip}"`).join(' ');
  const portsArray = proxyIps.map(p => p.port).join(' ');
  
  return `#!/bin/bash
# --- סקריפט התקנה אוטומטי עבור שרת: ${serverName} ---
# --- נוצר אוטומטית על ידי מערכת ניהול פרוקסי ---

# הגדרת כתובות IP ופורטים
IPS=(${ipsArray})
PORTS=(${portsArray})

# הרצת הסקריפט האוטומטי המלא
sudo bash -c '
set -e
export DEBIAN_FRONTEND=noninteractive

echo "📂 1/6: מנקה התקנות קודמות ומתקין Docker..."
apt-get update && apt-get install -y docker.io docker-compose curl
killall -9 tinyproxy 2>/dev/null || true
docker rm -f $(docker ps -aq --filter name=proxy-p) 2>/dev/null || true

echo "📡 2/6: מגדיר כתובות IP במערכת (Netplan)..."
INTERFACE=$(ip -o -4 route show to default | awk "{print \\$5}")
GATEWAY=$(ip route | grep default | awk "{print \\$3}")
NETPLAN_FILE="/etc/netplan/50-cloud-init.yaml"
cp $NETPLAN_FILE "\${NETPLAN_FILE}.bak"

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

echo "🏗️ 3/6: בונה אימג פרוקסי אנונימי מקומי..."
mkdir -p ~/proxy-factory && cd ~/proxy-factory
cat <<DOCKERFILE > Dockerfile
FROM alpine:latest
RUN apk add --no-cache tinyproxy
RUN echo -e "User tinyproxy\\nGroup tinyproxy\\nPort 8888\\nTimeout 600\\nMaxClients 500\\nAllow 0.0.0.0/0\\nDisableViaHeader Yes\\nConnectPort 443\\nConnectPort 5222\\nAnonymous \\"Host\\"\\nAnonymous \\"Authorization\\"\\nAnonymous \\"User-Agent\\"" > /etc/tinyproxy/tinyproxy.conf
CMD ["tinyproxy", "-d"]
DOCKERFILE
docker build -t local-tinyproxy .

echo "📝 4/6: מייצר קובץ Docker Compose דינאמי..."
cat <<COMPOSE > docker-compose.yml
version: "3.8"
services:
COMPOSE

for i in "\${!IPS[@]}"; do
    IP="\${IPS[$i]}"
    PORT="\${PORTS[$i]}"
    cat <<COMPOSE >> docker-compose.yml
  proxy-p$PORT:
    image: local-tinyproxy
    container_name: proxy-p$PORT
    restart: always
    ports:
      - "$IP:$PORT:8888"
COMPOSE
done

echo "🛡️ 5/6: פותח Firewall פנימי (UFW)..."
ufw allow ssh >> /dev/null
for PORT in "\${PORTS[@]}"; do
    ufw allow $PORT/tcp >> /dev/null
done
echo "y" | ufw enable >> /dev/null

echo "🚢 6/6: מפעיל את הקונטיינרים..."
docker-compose up -d

echo ""
echo "--- ✨ המערכת הוקמה בהצלחה! ---"
echo "רשימת הפרוקסים הפעילים שלך:"
docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"
'
`;
}

export default router;
