"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

interface ProxyIp {
  id: string;
  ip: string;
  port: number;
}

interface Server {
  id: string;
  name: string;
  mainIp: string;
  proxyIps: ProxyIp[];
  createdAt: string;
}

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  parentId: string | null;
  createdAt: string;
  tempPassword?: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [servers, setServers] = useState<Server[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<"servers" | "users">("servers");
  const [showServerModal, setShowServerModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [script, setScript] = useState("");
  const [loading, setLoading] = useState(true);

  const [serverForm, setServerForm] = useState({ name: "", mainIp: "", proxyIps: "" });
  const [userForm, setUserForm] = useState({ email: "", name: "", role: "viewer", parentId: "" });
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [newUserPassword, setNewUserPassword] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      fetchServers();
      if (session?.user?.role === "admin") {
        fetchUsers();
      }
    }
  }, [status, session]);

  const fetchServers = async () => {
    const res = await fetch("/api/servers");
    const data = await res.json();
    setServers(data);
    setLoading(false);
  };

  const fetchUsers = async () => {
    const res = await fetch("/api/users");
    const data = await res.json();
    setUsers(data);
  };

  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    const proxyIps = serverForm.proxyIps.split("\n").map(ip => ip.trim()).filter(Boolean);
    
    const res = await fetch("/api/servers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: serverForm.name,
        mainIp: serverForm.mainIp,
        proxyIps,
      }),
    });

    if (res.ok) {
      setShowServerModal(false);
      setServerForm({ name: "", mainIp: "", proxyIps: "" });
      fetchServers();
    }
  };

  const handleUpdateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingServer) return;

    const proxyIps = serverForm.proxyIps.split("\n").map(ip => ip.trim()).filter(Boolean);
    
    const res = await fetch(`/api/servers/${editingServer.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: serverForm.name,
        mainIp: serverForm.mainIp,
        proxyIps,
      }),
    });

    if (res.ok) {
      setShowServerModal(false);
      setServerForm({ name: "", mainIp: "", proxyIps: "" });
      setEditingServer(null);
      fetchServers();
    }
  };

  const handleDeleteServer = async (id: string) => {
    if (!confirm("האם אתה בטוח שברצונך למחוק שרת זה?")) return;
    
    const res = await fetch(`/api/servers/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchServers();
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userForm),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.tempPassword) {
        setNewUserPassword(data.tempPassword);
      } else {
        setShowUserModal(false);
        setUserForm({ email: "", name: "", role: "viewer", parentId: "" });
      }
      fetchUsers();
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm("האם אתה בטוח שברצונך למחוק משתמש זה?")) return;
    
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchUsers();
    }
  };

  const handleShowScript = async (server: Server) => {
    setSelectedServer(server);
    const res = await fetch(`/api/servers/${server.id}/script`);
    const text = await res.text();
    setScript(text);
    setShowScriptModal(true);
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(script);
  };

  const handleDownloadScript = () => {
    const blob = new Blob([script], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `setup-${selectedServer?.name.replace(/\s+/g, "-")}.sh`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openEditServer = (server: Server) => {
    setEditingServer(server);
    setServerForm({
      name: server.name,
      mainIp: server.mainIp,
      proxyIps: server.proxyIps.map(p => p.ip).join("\n"),
    });
    setShowServerModal(true);
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const isAdmin = session?.user?.role === "admin";
  const canEdit = session?.user?.role !== "viewer";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800" dir="rtl">
      {/* Header */}
      <header className="bg-gray-800/50 border-b border-gray-700 sticky top-0 z-40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white">מערכת ניהול פרוקסי</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm">{session?.user?.email}</span>
            <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400">
              {session?.user?.role === "admin" ? "מנהל" : session?.user?.role === "editor" ? "עורך" : "צופה"}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
            >
              התנתק
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      {isAdmin && (
        <div className="max-w-7xl mx-auto px-4 pt-6">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("servers")}
              className={`px-6 py-2 rounded-lg font-medium transition ${
                activeTab === "servers"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              שרתים
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`px-6 py-2 rounded-lg font-medium transition ${
                activeTab === "users"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              משתמשים
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === "servers" ? (
          <>
            {/* Add Server Button */}
            {canEdit && (
              <div className="mb-6">
                <button
                  onClick={() => {
                    setEditingServer(null);
                    setServerForm({ name: "", mainIp: "", proxyIps: "" });
                    setShowServerModal(true);
                  }}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  הוסף שרת
                </button>
              </div>
            )}

            {/* Servers Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {servers.map((server) => (
                <div
                  key={server.id}
                  className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-gray-600 transition"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{server.name}</h3>
                        <p className="text-sm text-gray-400">IP ראשי: {server.mainIp}</p>
                      </div>
                      <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <p className="text-sm text-gray-400">כתובות פרוקסי ({server.proxyIps.length}):</p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {server.proxyIps.map((proxy) => (
                          <div
                            key={proxy.id}
                            className="flex items-center justify-between text-sm bg-gray-700/50 rounded px-3 py-2"
                          >
                            <span className="text-gray-300 font-mono">{proxy.ip}</span>
                            <span className="text-blue-400">:{proxy.port}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4 border-t border-gray-700">
                      <button
                        onClick={() => handleShowScript(server)}
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition"
                      >
                        סקריפט התקנה
                      </button>
                      {canEdit && (
                        <>
                          <button
                            onClick={() => openEditServer(server)}
                            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteServer(server.id)}
                            className="px-3 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-sm rounded-lg transition"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {servers.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                    </svg>
                  </div>
                  <p className="text-gray-400">אין שרתים עדיין</p>
                  {canEdit && <p className="text-gray-500 text-sm mt-1">לחץ על "הוסף שרת" להתחיל</p>}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Add User Button */}
            <div className="mb-6">
              <button
                onClick={() => {
                  setUserForm({ email: "", name: "", role: "viewer", parentId: "" });
                  setNewUserPassword("");
                  setShowUserModal(true);
                }}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                הוסף משתמש
              </button>
            </div>

            {/* Users Table */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="px-6 py-4 text-right text-sm font-medium text-gray-300">אימייל</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-gray-300">שם</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-gray-300">תפקיד</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-gray-300">הצגת נתונים</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-gray-300">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-700/30 transition">
                      <td className="px-6 py-4 text-gray-300">{user.email}</td>
                      <td className="px-6 py-4 text-gray-300">{user.name || "-"}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            user.role === "admin"
                              ? "bg-purple-500/20 text-purple-400"
                              : user.role === "editor"
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-gray-500/20 text-gray-400"
                          }`}
                        >
                          {user.role === "admin" ? "מנהל" : user.role === "editor" ? "עורך" : "צופה"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-sm">
                        {user.parentId ? "נתוני הורה" : "נתונים עצמאיים"}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="px-3 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-sm rounded transition"
                        >
                          מחק
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                        אין משתמשים נוספים
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      {/* Server Modal */}
      {showServerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-lg">
            <div className="p-6 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white">
                {editingServer ? "ערוך שרת" : "הוסף שרת חדש"}
              </h2>
            </div>
            <form onSubmit={editingServer ? handleUpdateServer : handleCreateServer} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">שם השרת</label>
                <input
                  type="text"
                  value={serverForm.name}
                  onChange={(e) => setServerForm({ ...serverForm, name: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="לדוגמה: שרת ראשי"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">IP ראשי</label>
                <input
                  type="text"
                  value={serverForm.mainIp}
                  onChange={(e) => setServerForm({ ...serverForm, mainIp: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition font-mono"
                  placeholder="192.168.1.1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  כתובות IP של פרוקסי (כל כתובת בשורה חדשה)
                </label>
                <textarea
                  value={serverForm.proxyIps}
                  onChange={(e) => setServerForm({ ...serverForm, proxyIps: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition font-mono h-32 resize-none"
                  placeholder="212.80.206.30&#10;185.162.124.124&#10;188.191.147.116"
                  required
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                >
                  {editingServer ? "עדכן" : "הוסף"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowServerModal(false);
                    setEditingServer(null);
                  }}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-lg">
            <div className="p-6 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white">הוסף משתמש חדש</h2>
            </div>
            {newUserPassword ? (
              <div className="p-6">
                <div className="bg-green-500/10 border border-green-500 rounded-lg p-4 mb-4">
                  <p className="text-green-400 font-medium mb-2">משתמש נוצר בהצלחה!</p>
                  <p className="text-gray-300 text-sm">סיסמה זמנית:</p>
                  <p className="font-mono text-lg text-white bg-gray-700 rounded px-3 py-2 mt-2">{newUserPassword}</p>
                  <p className="text-gray-400 text-xs mt-2">הסיסמה נשלחה גם למייל המשתמש</p>
                </div>
                <button
                  onClick={() => {
                    setShowUserModal(false);
                    setNewUserPassword("");
                    setUserForm({ email: "", name: "", role: "viewer", parentId: "" });
                  }}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                >
                  סגור
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateUser} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">אימייל</label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">שם</label>
                  <input
                    type="text"
                    value={userForm.name}
                    onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">תפקיד</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  >
                    <option value="viewer">צופה - צפייה בלבד</option>
                    <option value="editor">עורך - יכול להוסיף ולערוך שרתים</option>
                    <option value="admin">מנהל - הרשאות מלאות</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">הצגת נתונים</label>
                  <select
                    value={userForm.parentId}
                    onChange={(e) => setUserForm({ ...userForm, parentId: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  >
                    <option value="">נתונים עצמאיים</option>
                    <option value={session?.user?.id}>הצג את הנתונים שלי</option>
                  </select>
                  <p className="text-gray-500 text-xs mt-1">
                    אם תבחר "הצג את הנתונים שלי", המשתמש יראה את השרתים שלך
                  </p>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                  >
                    צור משתמש
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowUserModal(false)}
                    className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                  >
                    ביטול
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Script Modal */}
      {showScriptModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                סקריפט התקנה - {selectedServer?.name}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={handleCopyScript}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  העתק
                </button>
                <button
                  onClick={handleDownloadScript}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  הורד
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap bg-gray-900 rounded-lg p-4 overflow-x-auto" dir="ltr">
                {script}
              </pre>
            </div>
            <div className="p-4 border-t border-gray-700">
              <button
                onClick={() => setShowScriptModal(false)}
                className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
