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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-xl border-b border-slate-700/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">מערכת ניהול פרוקסי</h1>
              <p className="text-sm text-slate-400">ניהול שרתים וכתובות IP</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 rounded-lg">
              <span className="text-slate-400 text-sm">{user?.email}</span>
              <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                user?.role === 'admin' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 
                user?.role === 'editor' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 
                'bg-slate-500/20 text-slate-400 border border-slate-500/30'
              }`}>
                {user?.role === 'admin' ? 'מנהל' : user?.role === 'editor' ? 'עורך' : 'צופה'}
              </span>
            </div>
            <button onClick={logout} className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition">
              <span className="hidden sm:inline">התנתק</span>
              <svg className="w-5 h-5 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.servers}</p>
                <p className="text-sm text-slate-400">שרתים</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/10 border border-cyan-500/20 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.ips}</p>
                <p className="text-sm text-slate-400">כתובות IP</p>
              </div>
            </div>
          </div>
          {isAdmin && (
            <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/20 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.users}</p>
                  <p className="text-sm text-slate-400">משתמשים</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      {isAdmin && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-2 border-b border-slate-700/50 pb-4">
            <button onClick={() => setActiveTab('servers')} className={`px-5 py-2.5 rounded-lg font-medium transition ${activeTab === 'servers' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2" /></svg>
                שרתים
              </span>
            </button>
            <button onClick={() => setActiveTab('users')} className={`px-5 py-2.5 rounded-lg font-medium transition ${activeTab === 'users' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                משתמשים
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'servers' ? (
          <>
            {canEdit && (
              <button onClick={() => { setEditingServer(null); setServerForm({ name: '', mainIp: '', proxyIps: '' }); setShowServerModal(true); }} className="mb-6 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-medium flex items-center gap-2 shadow-lg shadow-blue-500/30 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                הוסף שרת חדש
              </button>
            )}

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {servers.map(server => (
                <div key={server.id} className="group bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 hover:border-blue-500/30 transition-all duration-300 overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition">{server.name}</h3>
                        <p className="text-sm text-slate-400 font-mono mt-1">{server.main_ip}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-green-400">פעיל</span>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-slate-400">כתובות פרוקסי</p>
                        <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded-full">{server.proxyIps?.length || 0}</span>
                      </div>
                      <div className="max-h-28 overflow-y-auto space-y-1.5 custom-scrollbar">
                        {server.proxyIps?.map(proxy => (
                          <div key={proxy.id} className="flex justify-between items-center text-sm bg-slate-700/30 rounded-lg px-3 py-2">
                            <span className="text-slate-300 font-mono">{proxy.ip}</span>
                            <span className="text-blue-400 font-mono">:{proxy.port}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex border-t border-slate-700/50">
                    <button onClick={() => handleShowScript(server)} className="flex-1 px-4 py-3 text-sm font-medium text-blue-400 hover:bg-blue-500/10 transition flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                      סקריפט
                    </button>
                    {canEdit && (
                      <>
                        <button onClick={() => openEditServer(server)} className="px-4 py-3 text-sm text-slate-400 hover:text-white hover:bg-slate-700/50 transition border-r border-slate-700/50">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => handleDeleteServer(server.id)} className="px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {servers.length === 0 && (
                <div className="col-span-full text-center py-16">
                  <div className="w-20 h-20 bg-slate-700/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2" />
                    </svg>
                  </div>
                  <p className="text-slate-400 text-lg">אין שרתים עדיין</p>
                  {canEdit && <p className="text-slate-500 text-sm mt-2">לחץ על "הוסף שרת חדש" להתחלה</p>}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <button onClick={() => { setUserForm({ email: '', name: '', role: 'viewer', parentId: '' }); setNewUserPassword(''); setShowUserModal(true); }} className="mb-6 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-medium flex items-center gap-2 shadow-lg shadow-purple-500/30 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
              הוסף משתמש
            </button>

            <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-700/30">
                    <tr>
                      <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">אימייל</th>
                      <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">שם</th>
                      <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">תפקיד</th>
                      <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">פעולות</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-slate-700/20 transition">
                        <td className="px-6 py-4 text-slate-300 font-mono text-sm">{u.email}</td>
                        <td className="px-6 py-4 text-slate-300">{u.name || '-'}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${
                            u.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 
                            u.role === 'editor' ? 'bg-blue-500/20 text-blue-400' : 
                            'bg-slate-500/20 text-slate-400'
                          }`}>
                            {u.role === 'admin' ? 'מנהל' : u.role === 'editor' ? 'עורך' : 'צופה'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button onClick={() => handleDeleteUser(u.id)} className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm rounded-lg transition">מחק</button>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500">אין משתמשים נוספים</td>
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-lg shadow-2xl">
            <div className="p-6 border-b border-slate-700">
              <h2 className="text-xl font-bold text-white">{editingServer ? 'עריכת שרת' : 'הוספת שרת חדש'}</h2>
            </div>
            <form onSubmit={handleSaveServer} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">שם השרת</label>
                <input type="text" value={serverForm.name} onChange={(e) => setServerForm({ ...serverForm, name: e.target.value })} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="לדוגמה: שרת ראשי" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">כתובת IP ראשית</label>
                <input type="text" value={serverForm.mainIp} onChange={(e) => setServerForm({ ...serverForm, mainIp: e.target.value })} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="192.168.1.1" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">כתובות IP לפרוקסי (שורה לכל כתובת)</label>
                <textarea value={serverForm.proxyIps} onChange={(e) => setServerForm({ ...serverForm, proxyIps: e.target.value })} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white font-mono h-32 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none" placeholder="192.168.1.2&#10;192.168.1.3&#10;192.168.1.4" required />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition">
                  {editingServer ? 'עדכן שרת' : 'הוסף שרת'}
                </button>
                <button type="button" onClick={() => setShowServerModal(false)} className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition">ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-lg shadow-2xl">
            <div className="p-6 border-b border-slate-700">
              <h2 className="text-xl font-bold text-white">הוספת משתמש</h2>
            </div>
            {newUserPassword ? (
              <div className="p-6">
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5 mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-green-400 font-semibold">משתמש נוצר בהצלחה!</p>
                  </div>
                  <p className="text-slate-300 text-sm mb-2">סיסמה זמנית:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 font-mono text-lg text-white bg-slate-700/50 rounded-lg px-4 py-2">{newUserPassword}</code>
                    <button onClick={() => navigator.clipboard.writeText(newUserPassword)} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                    </button>
                  </div>
                </div>
                <button onClick={() => { setShowUserModal(false); setNewUserPassword(''); }} className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition">סגור</button>
              </div>
            ) : (
              <form onSubmit={handleCreateUser} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">אימייל</label>
                  <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">שם (אופציונלי)</label>
                  <input type="text" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">תפקיד</label>
                  <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition">
                    <option value="viewer">צופה - צפייה בלבד</option>
                    <option value="editor">עורך - יכול להוסיף ולערוך שרתים</option>
                    <option value="admin">מנהל - גישה מלאה</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">הצגת נתונים</label>
                  <select value={userForm.parentId} onChange={(e) => setUserForm({ ...userForm, parentId: e.target.value })} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition">
                    <option value="">נתונים עצמאיים - יראה רק שרתים שלו</option>
                    <option value={user?.id}>שיתוף - יראה את השרתים שלי</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium rounded-xl shadow-lg shadow-purple-500/30 transition">צור משתמש</button>
                  <button type="button" onClick={() => setShowUserModal(false)} className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition">ביטול</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Script Modal */}
      {showScriptModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">סקריפט התקנה</h2>
                <p className="text-sm text-slate-400 mt-1">{selectedServer?.name}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={copyScript} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                  העתק
                </button>
                <button onClick={downloadScript} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  הורד
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap bg-slate-900/50 rounded-xl p-4 border border-slate-700/50" dir="ltr">{script}</pre>
            </div>
            <div className="p-4 border-t border-slate-700">
              <button onClick={() => setShowScriptModal(false)} className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl transition">סגור</button>
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
          background: #475569;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }
      `}</style>
    </div>
  );
}
