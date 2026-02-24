import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [servers, setServers] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('servers');
  const [showServerModal, setShowServerModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [script, setScript] = useState('');
  const [selectedServer, setSelectedServer] = useState(null);
  const [editingServer, setEditingServer] = useState(null);
  const [serverForm, setServerForm] = useState({ name: '', mainIp: '', proxyIps: '' });
  const [userForm, setUserForm] = useState({ email: '', name: '', role: 'viewer', parentId: '' });
  const [newUserPassword, setNewUserPassword] = useState('');
  const [stats, setStats] = useState({ servers: 0, ips: 0, users: 0 });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchServers();
    if (user?.role === 'admin') fetchUsers();
  }, [user]);

  useEffect(() => {
    const totalIps = servers.reduce((sum, s) => sum + (s.proxyIps?.length || 0), 0);
    setStats({ servers: servers.length, ips: totalIps, users: users.length });
  }, [servers, users]);

  const fetchServers = async () => {
    const res = await fetch('/api/servers', { credentials: 'include' });
    const data = await res.json();
    setServers(data);
  };

  const fetchUsers = async () => {
    const res = await fetch('/api/users', { credentials: 'include' });
    const data = await res.json();
    setUsers(data);
  };

  const handleSaveServer = async (e) => {
    e.preventDefault();
    const proxyIps = serverForm.proxyIps.split('\n').map(ip => ip.trim()).filter(Boolean);
    const url = editingServer ? `/api/servers/${editingServer.id}` : '/api/servers';
    const method = editingServer ? 'PUT' : 'POST';

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: serverForm.name, mainIp: serverForm.mainIp, proxyIps })
    });

    setShowServerModal(false);
    setServerForm({ name: '', mainIp: '', proxyIps: '' });
    setEditingServer(null);
    fetchServers();
  };

  const handleDeleteServer = async (id) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק את השרת?')) return;
    await fetch(`/api/servers/${id}`, { method: 'DELETE', credentials: 'include' });
    fetchServers();
  };

  const handleShowScript = async (server) => {
    setSelectedServer(server);
    const res = await fetch(`/api/servers/${server.id}/script`, { credentials: 'include' });
    const text = await res.text();
    setScript(text);
    setShowScriptModal(true);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(userForm)
    });
    const data = await res.json();
    if (data.tempPassword) {
      setNewUserPassword(data.tempPassword);
    }
    fetchUsers();
  };

  const handleDeleteUser = async (id) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק את המשתמש?')) return;
    await fetch(`/api/users/${id}`, { method: 'DELETE', credentials: 'include' });
    fetchUsers();
  };

  const openEditServer = (server) => {
    setEditingServer(server);
    setServerForm({
      name: server.name,
      mainIp: server.main_ip,
      proxyIps: server.proxyIps.map(p => p.ip).join('\n')
    });
    setShowServerModal(true);
  };

  const copyScript = () => {
    navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadScript = () => {
    const blob = new Blob([script], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `setup-${selectedServer?.name.replace(/\s+/g, '-')}.sh`;
    a.click();
  };

  const isAdmin = user?.role === 'admin';
  const canEdit = user?.role !== 'viewer';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">מערכת ניהול פרוקסי</h1>
              <p className="text-sm text-gray-500">ניהול שרתים וכתובות IP</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-gray-100 rounded-xl">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-full flex items-center justify-center text-white text-sm font-bold">
                {user?.email?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">{user?.email}</p>
                <p className="text-xs text-gray-500">
                  {user?.role === 'admin' ? 'מנהל מערכת' : user?.role === 'editor' ? 'עורך' : 'צופה'}
                </p>
              </div>
            </div>
            <button onClick={logout} className="px-4 py-2.5 text-sm text-gray-600 hover:text-white hover:bg-red-500 bg-gray-100 hover:shadow-lg hover:shadow-red-200 rounded-xl transition-all flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">התנתק</span>
            </button>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-lg shadow-blue-100/50 border border-gray-100 hover:shadow-xl hover:shadow-blue-200/50 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2" />
                </svg>
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-800">{stats.servers}</p>
                <p className="text-gray-500 font-medium">שרתים</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg shadow-emerald-100/50 border border-gray-100 hover:shadow-xl hover:shadow-emerald-200/50 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-800">{stats.ips}</p>
                <p className="text-gray-500 font-medium">כתובות IP</p>
              </div>
            </div>
          </div>
          {isAdmin && (
            <div className="bg-white rounded-2xl p-6 shadow-lg shadow-purple-100/50 border border-gray-100 hover:shadow-xl hover:shadow-purple-200/50 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-200">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-800">{stats.users}</p>
                  <p className="text-gray-500 font-medium">משתמשים</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      {isAdmin && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-2 border-b border-gray-200 pb-4">
            <button onClick={() => setActiveTab('servers')} className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${activeTab === 'servers' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-200' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2" /></svg>
              שרתים
            </button>
            <button onClick={() => setActiveTab('users')} className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${activeTab === 'users' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-200' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              משתמשים
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'servers' ? (
          <>
            {canEdit && (
              <button onClick={() => { setEditingServer(null); setServerForm({ name: '', mainIp: '', proxyIps: '' }); setShowServerModal(true); }} className="mb-8 px-6 py-3.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 text-white rounded-xl font-semibold flex items-center gap-2 shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 transition-all transform hover:scale-[1.02]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                הוסף שרת חדש
              </button>
            )}

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {servers.map(server => (
                <div key={server.id} className="group bg-white rounded-2xl border border-gray-100 shadow-lg shadow-gray-100 hover:shadow-xl hover:shadow-indigo-100 transition-all duration-300 overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-800 group-hover:text-indigo-600 transition">{server.name}</h3>
                        <p className="text-sm text-gray-500 font-mono mt-1 bg-gray-100 px-2 py-1 rounded-lg inline-block">{server.main_ip}</p>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-green-600 font-medium">פעיל</span>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-gray-600">כתובות פרוקסי</p>
                        <span className="px-2.5 py-1 text-xs bg-indigo-100 text-indigo-600 rounded-full font-semibold">{server.proxyIps?.length || 0}</span>
                      </div>
                      <div className="max-h-32 overflow-y-auto space-y-2 custom-scrollbar">
                        {server.proxyIps?.map(proxy => (
                          <div key={proxy.id} className="flex justify-between items-center text-sm bg-gray-50 hover:bg-indigo-50 rounded-xl px-4 py-2.5 transition">
                            <span className="text-gray-700 font-mono">{proxy.ip}</span>
                            <span className="text-indigo-500 font-semibold">:{proxy.port}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex border-t border-gray-100 bg-gray-50/50">
                    <button onClick={() => handleShowScript(server)} className="flex-1 px-4 py-3.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 transition flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                      סקריפט
                    </button>
                    {canEdit && (
                      <>
                        <button onClick={() => openEditServer(server)} className="px-4 py-3.5 text-sm text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition border-r border-gray-100">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => handleDeleteServer(server.id)} className="px-4 py-3.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 transition">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {servers.length === 0 && (
                <div className="col-span-full text-center py-20">
                  <div className="w-24 h-24 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2" />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-xl font-medium">אין שרתים עדיין</p>
                  {canEdit && <p className="text-gray-400 mt-2">לחץ על "הוסף שרת חדש" להתחלה</p>}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <button onClick={() => { setUserForm({ email: '', name: '', role: 'viewer', parentId: '' }); setNewUserPassword(''); setShowUserModal(true); }} className="mb-8 px-6 py-3.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-semibold flex items-center gap-2 shadow-lg shadow-purple-200 hover:shadow-xl hover:shadow-purple-300 transition-all transform hover:scale-[1.02]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
              הוסף משתמש
            </button>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">אימייל</th>
                      <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">שם</th>
                      <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">תפקיד</th>
                      <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">פעולות</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-indigo-50/50 transition">
                        <td className="px-6 py-4 text-gray-700 font-mono text-sm">{u.email}</td>
                        <td className="px-6 py-4 text-gray-700">{u.name || '-'}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1.5 text-xs rounded-full font-semibold ${
                            u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 
                            u.role === 'editor' ? 'bg-blue-100 text-blue-700' : 
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {u.role === 'admin' ? 'מנהל' : u.role === 'editor' ? 'עורך' : 'צופה'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button onClick={() => handleDeleteUser(u.id)} className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm rounded-lg transition font-medium">מחק</button>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-16 text-center text-gray-400">אין משתמשים נוספים</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Server Modal */}
      {showServerModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl border border-gray-200 w-full max-w-lg shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-800">{editingServer ? 'עריכת שרת' : 'הוספת שרת חדש'}</h2>
              <p className="text-gray-500 mt-1">הגדר את פרטי השרת וכתובות ה-IP</p>
            </div>
            <form onSubmit={handleSaveServer} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">שם השרת</label>
                <input type="text" value={serverForm.name} onChange={(e) => setServerForm({ ...serverForm, name: e.target.value })} className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition" placeholder="לדוגמה: שרת ראשי" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">כתובת IP ראשית</label>
                <input type="text" value={serverForm.mainIp} onChange={(e) => setServerForm({ ...serverForm, mainIp: e.target.value })} className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition" placeholder="192.168.1.1" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">כתובות IP לפרוקסי (שורה לכל כתובת)</label>
                <textarea value={serverForm.proxyIps} onChange={(e) => setServerForm({ ...serverForm, proxyIps: e.target.value })} className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 font-mono h-36 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-none" placeholder="192.168.1.2&#10;192.168.1.3&#10;192.168.1.4" required />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="submit" className="flex-1 py-3.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold rounded-xl shadow-lg shadow-indigo-200 transition transform hover:scale-[1.02]">
                  {editingServer ? 'עדכן שרת' : 'הוסף שרת'}
                </button>
                <button type="button" onClick={() => setShowServerModal(false)} className="px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition">ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl border border-gray-200 w-full max-w-lg shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-800">הוספת משתמש</h2>
              <p className="text-gray-500 mt-1">הזמן משתמש חדש למערכת</p>
            </div>
            {newUserPassword ? (
              <div className="p-6">
                <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-green-700 font-bold text-lg">משתמש נוצר בהצלחה!</p>
                      <p className="text-green-600 text-sm">שלח את הסיסמה למשתמש</p>
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm mb-2">סיסמה זמנית:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 font-mono text-lg text-gray-800 bg-white rounded-xl px-4 py-3 border border-gray-200">{newUserPassword}</code>
                    <button onClick={() => navigator.clipboard.writeText(newUserPassword)} className="px-4 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                    </button>
                  </div>
                </div>
                <button onClick={() => { setShowUserModal(false); setNewUserPassword(''); }} className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold rounded-xl transition">סגור</button>
              </div>
            ) : (
              <form onSubmit={handleCreateUser} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">אימייל</label>
                  <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">שם (אופציונלי)</label>
                  <input type="text" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">תפקיד</label>
                  <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition">
                    <option value="viewer">צופה - צפייה בלבד</option>
                    <option value="editor">עורך - יכול להוסיף ולערוך שרתים</option>
                    <option value="admin">מנהל - גישה מלאה</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">הצגת נתונים</label>
                  <select value={userForm.parentId} onChange={(e) => setUserForm({ ...userForm, parentId: e.target.value })} className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition">
                    <option value="">נתונים עצמאיים - יראה רק שרתים שלו</option>
                    <option value={user?.id}>שיתוף - יראה את השרתים שלי</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="submit" className="flex-1 py-3.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-xl shadow-lg shadow-purple-200 transition transform hover:scale-[1.02]">צור משתמש</button>
                  <button type="button" onClick={() => setShowUserModal(false)} className="px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition">ביטול</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Script Modal */}
      {showScriptModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl border border-gray-200 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">סקריפט התקנה</h2>
                <p className="text-gray-500 mt-1">{selectedServer?.name}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={copyScript} className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                  {copied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      הועתק!
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                      העתק
                    </>
                  )}
                </button>
                <button onClick={downloadScript} className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-xl transition flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  הורד
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <pre className="text-sm text-gray-700 font-mono whitespace-pre-wrap bg-gray-50 rounded-2xl p-6 border border-gray-200" dir="ltr">{script}</pre>
            </div>
            <div className="p-4 border-t border-gray-100">
              <button onClick={() => setShowScriptModal(false)} className="w-full py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition">סגור</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
      `}</style>
    </div>
  );
}
