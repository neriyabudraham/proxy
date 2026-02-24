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

  useEffect(() => {
    fetchServers();
    if (user?.role === 'admin') fetchUsers();
  }, [user]);

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
    if (!confirm('האם אתה בטוח?')) return;
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
    if (!confirm('האם אתה בטוח?')) return;
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

  const isAdmin = user?.role === 'admin';
  const canEdit = user?.role !== 'viewer';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <header className="bg-gray-800/50 border-b border-gray-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white">מערכת ניהול פרוקסי</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm">{user?.email}</span>
            <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400">
              {user?.role === 'admin' ? 'מנהל' : user?.role === 'editor' ? 'עורך' : 'צופה'}
            </span>
            <button onClick={logout} className="px-4 py-2 text-sm text-gray-400 hover:text-white">התנתק</button>
          </div>
        </div>
      </header>

      {isAdmin && (
        <div className="max-w-7xl mx-auto px-4 pt-6">
          <div className="flex gap-2">
            <button onClick={() => setActiveTab('servers')} className={`px-6 py-2 rounded-lg font-medium transition ${activeTab === 'servers' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>שרתים</button>
            <button onClick={() => setActiveTab('users')} className={`px-6 py-2 rounded-lg font-medium transition ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>משתמשים</button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'servers' ? (
          <>
            {canEdit && (
              <button onClick={() => { setEditingServer(null); setServerForm({ name: '', mainIp: '', proxyIps: '' }); setShowServerModal(true); }} className="mb-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                הוסף שרת
              </button>
            )}

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {servers.map(server => (
                <div key={server.id} className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{server.name}</h3>
                      <p className="text-sm text-gray-400">IP ראשי: {server.main_ip}</p>
                    </div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm text-gray-400 mb-2">כתובות פרוקסי ({server.proxyIps?.length || 0}):</p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {server.proxyIps?.map(proxy => (
                        <div key={proxy.id} className="flex justify-between text-sm bg-gray-700/50 rounded px-3 py-2">
                          <span className="text-gray-300 font-mono">{proxy.ip}</span>
                          <span className="text-blue-400">:{proxy.port}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-gray-700">
                    <button onClick={() => handleShowScript(server)} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg">סקריפט</button>
                    {canEdit && (
                      <>
                        <button onClick={() => openEditServer(server)} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg">✏️</button>
                        <button onClick={() => handleDeleteServer(server.id)} className="px-3 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-sm rounded-lg">🗑️</button>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {servers.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <p className="text-gray-400">אין שרתים עדיין</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <button onClick={() => { setUserForm({ email: '', name: '', role: 'viewer', parentId: '' }); setNewUserPassword(''); setShowUserModal(true); }} className="mb-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              הוסף משתמש
            </button>

            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="px-6 py-4 text-right text-sm font-medium text-gray-300">אימייל</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-gray-300">שם</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-gray-300">תפקיד</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-gray-300">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {users.map(u => (
                    <tr key={u.id}>
                      <td className="px-6 py-4 text-gray-300">{u.email}</td>
                      <td className="px-6 py-4 text-gray-300">{u.name || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${u.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : u.role === 'editor' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}`}>
                          {u.role === 'admin' ? 'מנהל' : u.role === 'editor' ? 'עורך' : 'צופה'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button onClick={() => handleDeleteUser(u.id)} className="px-3 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-sm rounded">מחק</button>
                      </td>
                    </tr>
                  ))}
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
              <h2 className="text-xl font-bold text-white">{editingServer ? 'ערוך שרת' : 'הוסף שרת חדש'}</h2>
            </div>
            <form onSubmit={handleSaveServer} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">שם השרת</label>
                <input type="text" value={serverForm.name} onChange={(e) => setServerForm({ ...serverForm, name: e.target.value })} className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">IP ראשי</label>
                <input type="text" value={serverForm.mainIp} onChange={(e) => setServerForm({ ...serverForm, mainIp: e.target.value })} className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">כתובות IP (כל אחת בשורה)</label>
                <textarea value={serverForm.proxyIps} onChange={(e) => setServerForm({ ...serverForm, proxyIps: e.target.value })} className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono h-32" required />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">{editingServer ? 'עדכן' : 'הוסף'}</button>
                <button type="button" onClick={() => setShowServerModal(false)} className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">ביטול</button>
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
              <h2 className="text-xl font-bold text-white">הוסף משתמש</h2>
            </div>
            {newUserPassword ? (
              <div className="p-6">
                <div className="bg-green-500/10 border border-green-500 rounded-lg p-4 mb-4">
                  <p className="text-green-400 font-medium mb-2">משתמש נוצר!</p>
                  <p className="text-gray-300 text-sm">סיסמה זמנית:</p>
                  <p className="font-mono text-lg text-white bg-gray-700 rounded px-3 py-2 mt-2">{newUserPassword}</p>
                </div>
                <button onClick={() => { setShowUserModal(false); setNewUserPassword(''); }} className="w-full py-3 bg-blue-600 text-white rounded-lg">סגור</button>
              </div>
            ) : (
              <form onSubmit={handleCreateUser} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">אימייל</label>
                  <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">שם</label>
                  <input type="text" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">תפקיד</label>
                  <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white">
                    <option value="viewer">צופה</option>
                    <option value="editor">עורך</option>
                    <option value="admin">מנהל</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">הצגת נתונים</label>
                  <select value={userForm.parentId} onChange={(e) => setUserForm({ ...userForm, parentId: e.target.value })} className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white">
                    <option value="">נתונים עצמאיים</option>
                    <option value={user?.id}>הצג את הנתונים שלי</option>
                  </select>
                </div>
                <div className="flex gap-3">
                  <button type="submit" className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">צור משתמש</button>
                  <button type="button" onClick={() => setShowUserModal(false)} className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">ביטול</button>
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
              <h2 className="text-xl font-bold text-white">סקריפט התקנה - {selectedServer?.name}</h2>
              <div className="flex gap-2">
                <button onClick={() => navigator.clipboard.writeText(script)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg">העתק</button>
                <button onClick={() => {
                  const blob = new Blob([script], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `setup-${selectedServer?.name}.sh`;
                  a.click();
                }} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg">הורד</button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap bg-gray-900 rounded-lg p-4" dir="ltr">{script}</pre>
            </div>
            <div className="p-4 border-t border-gray-700">
              <button onClick={() => setShowScriptModal(false)} className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">סגור</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
