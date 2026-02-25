import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function generateScript(serverName: string, ips: string[]): string {
  const ipsString = ips.map((ip) => `"${ip}"`).join(" ");

  const scriptParts = [
    "#!/bin/bash",
    `# --- סקריפט התקנה אוטומטי עבור שרת: ${serverName} ---`,
    "# --- נוצר אוטומטית על ידי מערכת ניהול פרוקסי ---",
    "",
    "# --- הגדרת ה-IPs ---",
    `IPS=(${ipsString})`,
    "",
    "# --- תחילת הסקריפט האוטומטי ---",
    "sudo bash -c '",
    "set -e",
    'echo "🚀 מתחיל תהליך הקמה דינאמי הכולל Firewall..."',
    "",
    "# 1. זיהוי נתוני רשת",
    'INTERFACE=$(ip -o -4 route show to default | awk "{print \\$5}")',
    'GATEWAY=$(ip route | grep default | awk "{print \\$3}")',
    'echo "📡 מזוהה ממשק: $INTERFACE, Gateway: $GATEWAY"',
    "",
    "# 2. עדכון Netplan (הגדרת הכתובות בשרת)",
    'echo "⚙️ מעדכן הגדרות רשת (Netplan)..."',
    'NETPLAN_FILE="/etc/netplan/50-cloud-init.yaml"',
    '[ -f $NETPLAN_FILE ] && cp $NETPLAN_FILE "${NETPLAN_FILE}.bak"',
    "",
    "cat <<EOF > $NETPLAN_FILE",
    "network:",
    "    version: 2",
    "    ethernets:",
    "        $INTERFACE:",
    "            addresses:",
    "EOF",
    "",
    'for ip in "${IPS[@]}"; do',
    '    echo "            - $ip/32" >> $NETPLAN_FILE',
    "done",
    "",
    "cat <<EOF >> $NETPLAN_FILE",
    "            routes:",
    "                - to: default",
    "                  via: $GATEWAY",
    "            nameservers:",
    "                addresses: [8.8.8.8, 1.1.1.1]",
    "EOF",
    "",
    "netplan apply",
    "sleep 2",
    "",
    "# 3. התקנה וניקוי",
    "apt update && apt install tinyproxy curl -y",
    "killall -9 tinyproxy 2>/dev/null || true",
    "mkdir -p /etc/tinyproxy/instances /var/log/tinyproxy /run/tinyproxy",
    "chown -R tinyproxy:tinyproxy /var/log/tinyproxy /run/tinyproxy",
    "",
    "# 4. הגדרת Firewall פנימי (UFW)",
    'echo "🛡️ מעדכן חומת אש פנימית (UFW)..."',
    "ufw allow ssh || true",
    "PORT=8080",
    'for ip in "${IPS[@]}"; do',
    "    ufw allow $PORT/tcp >> /dev/null",
    "    PORT=$((PORT + 1))",
    "done",
    'echo "y" | ufw enable || true',
    "",
    "# 5. יצירת מופעים ופורטים",
    'echo "🛠️ מקים מופעי פרוקסי..."',
    "PORT=8080",
    'START_SCRIPT="/usr/local/bin/start-proxies.sh"',
    'echo "#!/bin/bash" > $START_SCRIPT',
    'echo "killall -9 tinyproxy 2>/dev/null" >> $START_SCRIPT',
    "",
    'for ip in "${IPS[@]}"; do',
    '    CONF="/etc/tinyproxy/instances/p${PORT}.conf"',
    "    cat <<EOF > $CONF",
    "User tinyproxy",
    "Group tinyproxy",
    "Port $PORT",
    "Listen 0.0.0.0",
    "Bind $ip",
    "Timeout 600",
    "MaxClients 100",
    "Allow 0.0.0.0/0",
    "DisableViaHeader Yes",
    "ConnectPort 443",
    "ConnectPort 5222",
    'PidFile "/run/tinyproxy/p${PORT}.pid"',
    'LogFile "/var/log/tinyproxy/p${PORT}.log"',
    'Anonymous "Host"',
    'Anonymous "Authorization"',
    'Anonymous "User-Agent"',
    "EOF",
    '    echo "tinyproxy -c $CONF" >> $START_SCRIPT',
    "    PORT=$((PORT + 1))",
    "done",
    "",
    "# 6. הגדרת שירות מערכת (Persistence)",
    "chmod +x $START_SCRIPT",
    "cat <<EOF > /etc/systemd/system/proxy-farm.service",
    "[Unit]",
    "Description=Dynamic Proxy Farm",
    "After=network.target",
    "",
    "[Service]",
    "Type=forking",
    "ExecStart=$START_SCRIPT",
    "Restart=always",
    "",
    "[Install]",
    "WantedBy=multi-user.target",
    "EOF",
    "",
    "systemctl daemon-reload",
    "systemctl enable proxy-farm.service",
    "systemctl start proxy-farm.service",
    "sleep 2",
    "",
    "# 7. בדיקה עצמית סופית",
    'echo "--- 🔍 מבצע בדיקת תקינות סופית --- "',
    "PORT=8080",
    'for ip in "${IPS[@]}"; do',
    '    RESULT=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 -x http://localhost:$PORT http://www.google.com || echo "FAILED")',
    '    if [ "$RESULT" == "200" ]; then',
    '        echo "✅ Port $PORT ($ip): עובד!"',
    "    else",
    '        echo "❌ Port $PORT ($ip): נכשל (בדוק Firewall חיצוני)"',
    "    fi",
    "    PORT=$((PORT + 1))",
    "done",
    "",
    'echo "--- ✨ הסקריפט הסתיים! ---"',
    "'",
  ];

  return scriptParts.join("\n");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const server = await prisma.server.findUnique({
      where: { id },
      include: {
        proxyIps: {
          orderBy: { port: "asc" },
        },
      },
    });

    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    const ips = server.proxyIps.map((p) => p.ip);
    const script = generateScript(server.name, ips);

    return new NextResponse(script, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="setup-${server.name.replace(/\s+/g, "-")}.sh"`,
      },
    });
  } catch (error) {
    console.error("Generate script error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
