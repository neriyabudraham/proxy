import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [servers, setServers] = useState([]);
  const [users, setUsers] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [settings, setSettings] = useState({ maxPhonesPerProxy: 3 });
  const [activeTab, setActiveTab] = useState('servers');
  const [showServerModal, setShowServerModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showProxyModal, setShowProxyModal] = useState(false);
  const [script, setScript] = useState('');
  const [selectedServer, setSelectedServer] = useState(null);
  const [selectedProxy, setSelectedProxy] = useState(null);
  const [editingServer, setEditingServer] = useState(null);
  const [serverForm, setServerForm] = useState({ name: '', mainIp: '' });
  const [proxyForm, setProxyForm] = useState({ ip: '', port: '' });
  const [userForm, setUserForm] = useState({ email: '', role: 'viewer' });
  const [inviteLink, setInviteLink] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newApiKeyName, setNewApiKeyName] = useState('');
  const [stats, setStats] = useState({ servers: 0, ips: 0, users: 0, phones: 0 });
  const [copied, setCopied] = useState('');
  const [selectedApiKey, setSelectedApiKey] = useState(null);

  const baseUrl = window.location.origin;

  useEffect(() => {
    fetchServers();
    fetchApiKeys();
    fetchSettings();
    if (user?.role === 'admin') fetchUsers();
  }, [user]);

  useEffect(() => {
    const totalIps = servers.reduce((sum, s) => sum + (s.proxyIps?.length || 0), 0);
    const totalPhones = servers.reduce((sum, s) => 
      sum + s.proxyIps?.reduce((pSum, p) => pSum + (p.phones?.length || 0), 0), 0);
    setStats({ servers: servers.length, ips: totalIps, users: users.length, phones: totalPhones });
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

  const fetchApiKeys = async () => {
    const res = await fetch('/api/v1/keys', { credentials: 'include' });
    const data = await res.json();
    setApiKeys(data);
  };

  const fetchSettings = async () => {
    const res = await fetch('/api/v1/settings', { credentials: 'include' });
    const data = await res.json();
    setSettings(data);
  };

  const handleSaveServer = async (e) => {
    e.preventDefault();
    const url = editingServer ? `/api/servers/${editingServer.id}` : '/api/servers';
    const method = editingServer ? 'PUT' : 'POST';

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(serverForm)
    });

    setShowServerModal(false);
    setServerForm({ name: '', mainIp: '' });
    setEditingServer(null);
    fetchServers();
  };

  const handleDeleteServer = async (id) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק את השרת?')) return;
    await fetch(`/api/servers/${id}`, { method: 'DELETE', credentials: 'include' });
    fetchServers();
  };

  const handleAddProxy = async (e) => {
    e.preventDefault();
    await fetch(`/api/servers/${selectedServer.id}/proxies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ip: proxyForm.ip, port: proxyForm.port ? parseInt(proxyForm.port) : null })
    });
    setProxyForm({ ip: '', port: '' });
    fetchServers();
  };

  const handleDeleteProxy = async (serverId, proxyId) => {
    if (!confirm('האם אתה בטוח?')) return;
    await fetch(`/api/servers/${serverId}/proxies/${proxyId}`, { method: 'DELETE', credentials: 'include' });
    fetchServers();
  };

  const handleShowScript = async (server) => {
    setSelectedServer(server);
    try {
      const res = await fetch(`/api/servers/${server.id}/script`, { credentials: 'include' });
      const contentType = res.headers.get('content-type');
      
      if (res.ok) {
        const text = await res.text();
        setScript(text);
        setShowScriptModal(true);
      } else {
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          alert(data.error || 'שגיאה בהבאת הסקריפט');
        } else {
          alert('שגיאה בהבאת הסקריפט - אין כתובות פרוקסי מוגדרות?');
        }
      }
    } catch (err) {
      console.error('Script fetch error:', err);
      alert('שגיאה בהבאת הסקריפט');
    }
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
    if (data.invite_token) {
      setInviteLink(`${baseUrl}/invite/${data.invite_token}`);
    }
    fetchUsers();
  };

  const handleRegenerateInvite = async (userId) => {
    const res = await fetch(`/api/users/${userId}/regenerate-invite`, {
      method: 'POST',
      credentials: 'include'
    });
    const data = await res.json();
    if (data.invite_token) {
      copyToClipboard(`${baseUrl}/invite/${data.invite_token}`, `invite-${userId}`);
      alert('לינק הזמנה חדש הועתק!');
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
    setServerForm({ name: server.name, mainIp: server.main_ip });
    setShowServerModal(true);
  };

  const openProxyManager = (server) => {
    setSelectedServer(server);
    setProxyForm({ ip: '', port: '' });
    setShowProxyModal(true);
  };

  const handleAddPhone = async (e) => {
    e.preventDefault();
    await fetch(`/api/servers/proxy/${selectedProxy.id}/phones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ phone: newPhone })
    });
    setNewPhone('');
    fetchServers();
  };

  const handleRemovePhone = async (phoneId) => {
    await fetch(`/api/servers/proxy/${selectedProxy.id}/phones/${phoneId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    fetchServers();
  };

  const handleCreateApiKey = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/v1/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: newApiKeyName })
    });
    const data = await res.json();
    setSelectedApiKey(data);
    fetchApiKeys();
  };

  const handleDeleteApiKey = async (id) => {
    if (!confirm('האם אתה בטוח?')) return;
    await fetch(`/api/v1/keys/${id}`, { method: 'DELETE', credentials: 'include' });
    if (selectedApiKey?.id === id) setSelectedApiKey(null);
    fetchApiKeys();
  };

  const handleSaveSettings = async () => {
    await fetch('/api/v1/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(settings)
    });
    alert('ההגדרות נשמרו');
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(''), 2000);
  };

  const downloadScript = () => {
    const blob = new Blob([script], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `setup-${selectedServer?.name.replace(/\s+/g, '-')}.sh`;
    a.click();
  };

  const getCurlExample = (endpoint, method, body, apiKey) => {
    const key = apiKey || selectedApiKey?.key || 'YOUR_API_KEY';
    let curl = `curl -X ${method} "${baseUrl}/api/v1${endpoint}"`;
    curl += ` \\\n  -H "X-API-Key: ${key}"`;
    if (body) {
      curl += ` \\\n  -H "Content-Type: application/json"`;
      curl += ` \\\n  -d '${JSON.stringify(body)}'`;
    }
    return curl;
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-white rounded-2xl p-5 shadow-lg shadow-blue-100/50 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{stats.servers}</p>
                <p className="text-gray-500 text-sm">שרתים</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-lg shadow-emerald-100/50 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{stats.ips}</p>
                <p className="text-gray-500 text-sm">פרוקסי</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-lg shadow-orange-100/50 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-200">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{stats.phones}</p>
                <p className="text-gray-500 text-sm">טלפונים</p>
              </div>
            </div>
          </div>
          {isAdmin && (
            <div className="bg-white rounded-2xl p-5 shadow-lg shadow-purple-100/50 border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-200">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{stats.users}</p>
                  <p className="text-gray-500 text-sm">משתמשים</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex gap-2 border-b border-gray-200 pb-4 overflow-x-auto">
          <button onClick={() => setActiveTab('servers')} className={`px-5 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'servers' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-200' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2" /></svg>
            שרתים
          </button>
          {isAdmin && (
            <button onClick={() => setActiveTab('users')} className={`px-5 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'users' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-200' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              משתמשים
            </button>
          )}
          <button onClick={() => setActiveTab('api')} className={`px-5 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'api' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-200' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
            API
          </button>
          <button onClick={() => setActiveTab('settings')} className={`px-5 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'settings' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-200' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            הגדרות
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'servers' && (
          <>
            {canEdit && (
              <button onClick={() => { setEditingServer(null); setServerForm({ name: '', mainIp: '' }); setShowServerModal(true); }} className="mb-8 px-6 py-3.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 text-white rounded-xl font-semibold flex items-center gap-2 shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                הוסף שרת חדש
              </button>
            )}

            <div className="space-y-6">
              {servers.map(server => (
                <div key={server.id} className="bg-white rounded-2xl border border-gray-100 shadow-lg overflow-hidden">
                  <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-800">{server.name}</h3>
                        <p className="text-sm text-gray-500 font-mono">{server.main_ip}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleShowScript(server)} className="px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg font-medium text-sm transition">סקריפט</button>
                      {canEdit && (
                        <>
                          <button onClick={() => openProxyManager(server)} className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg font-medium text-sm transition">+ פרוקסי</button>
                          <button onClick={() => openEditServer(server)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={() => handleDeleteServer(server.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-6">
                    {server.proxyIps?.length > 0 ? (
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {server.proxyIps.map(proxy => (
                          <div key={proxy.id} className="bg-gray-50 rounded-xl p-4 hover:bg-indigo-50 transition group">
                            <div className="flex items-center justify-between mb-3">
                              <button 
                                onClick={() => copyToClipboard(`${proxy.ip}:${proxy.port}`, `proxy-${proxy.id}`)}
                                className="flex items-center gap-2 font-mono text-gray-800 hover:text-indigo-600 transition"
                              >
                                <span className="font-semibold">{proxy.ip}:{proxy.port}</span>
                                {copied === `proxy-${proxy.id}` ? (
                                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                ) : (
                                  <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                )}
                              </button>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 text-xs rounded-full ${proxy.phones?.length >= settings.maxPhonesPerProxy ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                  {proxy.phones?.length || 0}/{settings.maxPhonesPerProxy}
                                </span>
                                {canEdit && (
                                  <button onClick={() => handleDeleteProxy(server.id, proxy.id)} className="p-1 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            <div className="space-y-1 mb-3">
                              {proxy.phones?.slice(0, 3).map(phone => (
                                <div key={phone.id} className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-1.5">
                                  <span className="text-gray-600">{phone.phone}</span>
                                  {canEdit && (
                                    <button onClick={() => { setSelectedProxy(proxy); handleRemovePhone(phone.id); }} className="text-red-400 hover:text-red-600">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                  )}
                                </div>
                              ))}
                              {proxy.phones?.length > 3 && (
                                <p className="text-xs text-gray-500 text-center">+{proxy.phones.length - 3} נוספים</p>
                              )}
                            </div>
                            
                            {canEdit && (
                              <button onClick={() => { setSelectedProxy(proxy); setShowPhoneModal(true); }} className="w-full py-2 text-sm text-indigo-600 hover:bg-indigo-100 rounded-lg transition">
                                + הוסף טלפון
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p>אין כתובות פרוקסי</p>
                        {canEdit && (
                          <button onClick={() => openProxyManager(server)} className="mt-2 text-indigo-600 hover:underline">+ הוסף פרוקסי</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {servers.length === 0 && (
                <div className="text-center py-20 bg-white rounded-2xl">
                  <div className="w-24 h-24 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2" />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-xl font-medium">אין שרתים עדיין</p>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'users' && isAdmin && (
          <>
            <button onClick={() => { setUserForm({ email: '', role: 'viewer' }); setInviteLink(''); setShowUserModal(true); }} className="mb-8 px-6 py-3.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-semibold flex items-center gap-2 shadow-lg shadow-purple-200">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
              הוסף משתמש
            </button>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">אימייל</th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">תפקיד</th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">סטטוס</th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-gray-700 font-mono text-sm">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1.5 text-xs rounded-full font-semibold ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : u.role === 'editor' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                          {u.role === 'admin' ? 'מנהל' : u.role === 'editor' ? 'עורך' : 'צופה'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {u.invite_token ? (
                          <span className="px-3 py-1.5 text-xs rounded-full font-semibold bg-yellow-100 text-yellow-700">ממתין להרשמה</span>
                        ) : (
                          <span className="px-3 py-1.5 text-xs rounded-full font-semibold bg-green-100 text-green-700">פעיל</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          {u.invite_token && (
                            <button onClick={() => handleRegenerateInvite(u.id)} className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-sm rounded-lg">העתק לינק</button>
                          )}
                          <button onClick={() => handleDeleteUser(u.id)} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm rounded-lg">מחק</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'api' && (
          <div className="space-y-8">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-800">מפתחות API</h3>
                <button onClick={() => { setNewApiKeyName(''); setSelectedApiKey(null); setShowApiKeyModal(true); }} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium text-sm">
                  + צור מפתח חדש
                </button>
              </div>
              
              <div className="space-y-3">
                {apiKeys.map(key => (
                  <div key={key.id} className={`bg-gray-50 rounded-xl p-4 border-2 transition cursor-pointer ${selectedApiKey?.id === key.id ? 'border-indigo-500' : 'border-transparent hover:border-gray-200'}`} onClick={() => setSelectedApiKey(key)}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{key.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="font-mono text-sm text-gray-600 bg-white px-2 py-1 rounded">{key.key}</code>
                          <button onClick={(e) => { e.stopPropagation(); copyToClipboard(key.key, `key-${key.id}`); }} className={`px-2 py-1 text-xs rounded ${copied === `key-${key.id}` ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                            {copied === `key-${key.id}` ? 'הועתק!' : 'העתק'}
                          </button>
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteApiKey(key.id); }} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm rounded-lg">מחק</button>
                    </div>
                  </div>
                ))}
                {apiKeys.length === 0 && (
                  <p className="text-center text-gray-500 py-8">אין מפתחות API</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">תיעוד API עם דוגמאות cURL</h3>
              {selectedApiKey ? (
                <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg mb-4">משתמש במפתח: {selectedApiKey.name}</p>
              ) : (
                <p className="text-sm text-yellow-600 bg-yellow-50 px-3 py-2 rounded-lg mb-4">בחר מפתח API מהרשימה למעלה לקבלת דוגמאות מותאמות</p>
              )}
              
              <div className="space-y-6">
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-gray-700">שיוך טלפון לפרוקסי ספציפי</p>
                    <button onClick={() => copyToClipboard(getCurlExample('/phone/assign', 'POST', { phone: "0501234567", proxyIp: "1.2.3.4", port: 8080 }), 'curl-assign')} className={`px-3 py-1 text-xs rounded ${copied === 'curl-assign' ? 'bg-green-100 text-green-600' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
                      {copied === 'curl-assign' ? 'הועתק!' : 'העתק'}
                    </button>
                  </div>
                  <pre className="bg-gray-800 text-green-400 p-4 rounded-lg font-mono text-xs overflow-x-auto" dir="ltr">{getCurlExample('/phone/assign', 'POST', { phone: "0501234567", proxyIp: "1.2.3.4", port: 8080 })}</pre>
                  <p className="text-xs text-gray-500 mt-2">* מספר טלפון ישראלי ינורמל אוטומטית לפורמט 972XXXXXXXXX</p>
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-gray-700">שיוך טלפון אוטומטי (לפרוקסי פנוי)</p>
                    <button onClick={() => copyToClipboard(getCurlExample('/phone/assign', 'POST', { phone: "0501234567" }), 'curl-assign-auto')} className={`px-3 py-1 text-xs rounded ${copied === 'curl-assign-auto' ? 'bg-green-100 text-green-600' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
                      {copied === 'curl-assign-auto' ? 'הועתק!' : 'העתק'}
                    </button>
                  </div>
                  <pre className="bg-gray-800 text-green-400 p-4 rounded-lg font-mono text-xs overflow-x-auto" dir="ltr">{getCurlExample('/phone/assign', 'POST', { phone: "0501234567" })}</pre>
                  <p className="text-xs text-gray-500 mt-2">* ללא proxyIp - ישויך אוטומטית לפרוקסי הפנוי ביותר</p>
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-gray-700">הסרת שיוך טלפון</p>
                    <button onClick={() => copyToClipboard(getCurlExample('/phone/remove', 'POST', { phone: "0501234567" }), 'curl-remove')} className={`px-3 py-1 text-xs rounded ${copied === 'curl-remove' ? 'bg-green-100 text-green-600' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
                      {copied === 'curl-remove' ? 'הועתק!' : 'העתק'}
                    </button>
                  </div>
                  <pre className="bg-gray-800 text-green-400 p-4 rounded-lg font-mono text-xs overflow-x-auto" dir="ltr">{getCurlExample('/phone/remove', 'POST', { phone: "0501234567" })}</pre>
                  <p className="text-xs text-gray-500 mt-2">* מספיק להזין רק את מספר הטלפון להסרה מכל הפרוקסי</p>
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-gray-700">קבלת פרוקסי פנוי אחד</p>
                    <button onClick={() => copyToClipboard(getCurlExample('/proxy/available', 'GET', null), 'curl-one')} className={`px-3 py-1 text-xs rounded ${copied === 'curl-one' ? 'bg-green-100 text-green-600' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
                      {copied === 'curl-one' ? 'הועתק!' : 'העתק'}
                    </button>
                  </div>
                  <pre className="bg-gray-800 text-green-400 p-4 rounded-lg font-mono text-xs overflow-x-auto" dir="ltr">{getCurlExample('/proxy/available', 'GET', null)}</pre>
                  <p className="text-xs text-gray-500 mt-2">* מחזיר פרוקסי פנוי אחד (IP:PORT)</p>
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-gray-700">קבלת כל הפרוקסי הפנויים</p>
                    <button onClick={() => copyToClipboard(getCurlExample('/proxies/available', 'GET', null), 'curl-available')} className={`px-3 py-1 text-xs rounded ${copied === 'curl-available' ? 'bg-green-100 text-green-600' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
                      {copied === 'curl-available' ? 'הועתק!' : 'העתק'}
                    </button>
                  </div>
                  <pre className="bg-gray-800 text-green-400 p-4 rounded-lg font-mono text-xs overflow-x-auto" dir="ltr">{getCurlExample('/proxies/available', 'GET', null)}</pre>
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-gray-700">קבלת כל הפרוקסי</p>
                    <button onClick={() => copyToClipboard(getCurlExample('/proxies/all', 'GET', null), 'curl-all')} className={`px-3 py-1 text-xs rounded ${copied === 'curl-all' ? 'bg-green-100 text-green-600' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
                      {copied === 'curl-all' ? 'הועתק!' : 'העתק'}
                    </button>
                  </div>
                  <pre className="bg-gray-800 text-green-400 p-4 rounded-lg font-mono text-xs overflow-x-auto" dir="ltr">{getCurlExample('/proxies/all', 'GET', null)}</pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-6 max-w-xl">
              <h3 className="text-lg font-bold text-gray-800 mb-6">הגדרות כלליות</h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">מספר טלפונים מקסימלי לפרוקסי (פנוי)</label>
                  <p className="text-sm text-gray-500 mb-3">פרוקסי ייחשב "פנוי" אם יש לו פחות ממספר זה של טלפונים משויכים</p>
                  <input 
                    type="number" 
                    min="1" 
                    value={settings.maxPhonesPerProxy} 
                    onChange={(e) => setSettings({ ...settings, maxPhonesPerProxy: parseInt(e.target.value) || 3 })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                
                <button onClick={handleSaveSettings} className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-xl font-semibold shadow-lg shadow-indigo-200">
                  שמור הגדרות
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-2">תבנית סקריפט מותאמת אישית</h3>
              <p className="text-sm text-gray-500 mb-4">השאר ריק לשימוש בתבנית ברירת המחדל. השתמש ב-<code className="bg-gray-100 px-1 rounded">{`{{IPS}}`}</code> למיקום כתובות ה-IP ו-<code className="bg-gray-100 px-1 rounded">{`{{SERVER_NAME}}`}</code> לשם השרת.</p>
              
              <textarea
                value={settings.scriptTemplate || ''}
                onChange={(e) => setSettings({ ...settings, scriptTemplate: e.target.value })}
                placeholder="השאר ריק לתבנית ברירת מחדל..."
                className="w-full h-96 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 font-mono text-sm focus:ring-2 focus:ring-indigo-500 resize-none"
                dir="ltr"
                spellCheck={false}
              />
              
              <div className="flex gap-3 mt-4">
                <button onClick={handleSaveSettings} className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-xl font-semibold shadow-lg shadow-indigo-200">
                  שמור תבנית
                </button>
                {settings.scriptTemplate && (
                  <button onClick={() => setSettings({ ...settings, scriptTemplate: '' })} className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold">
                    אפס לברירת מחדל
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Server Modal */}
      {showServerModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl border border-gray-200 w-full max-w-lg shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-800">{editingServer ? 'עריכת שרת' : 'הוספת שרת חדש'}</h2>
            </div>
            <form onSubmit={handleSaveServer} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">שם השרת</label>
                <input type="text" value={serverForm.name} onChange={(e) => setServerForm({ ...serverForm, name: e.target.value })} className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:ring-2 focus:ring-indigo-500" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">כתובת IP ראשית</label>
                <input type="text" value={serverForm.mainIp} onChange={(e) => setServerForm({ ...serverForm, mainIp: e.target.value })} className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 font-mono focus:ring-2 focus:ring-indigo-500" required />
              </div>
              <p className="text-sm text-gray-500">לאחר יצירת השרת, תוכל להוסיף כתובות פרוקסי דרך כפתור "+ פרוקסי"</p>
              <div className="flex gap-3 pt-4">
                <button type="submit" className="flex-1 py-3.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold rounded-xl shadow-lg">{editingServer ? 'עדכן' : 'הוסף'}</button>
                <button type="button" onClick={() => setShowServerModal(false)} className="px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl">ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Proxy Manager Modal */}
      {showProxyModal && selectedServer && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl border border-gray-200 w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-800">ניהול פרוקסי</h2>
              <p className="text-gray-500">{selectedServer.name}</p>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">
              <form onSubmit={handleAddProxy} className="flex gap-3 mb-6">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">כתובת IP</label>
                  <input type="text" value={proxyForm.ip} onChange={(e) => setProxyForm({ ...proxyForm, ip: e.target.value })} placeholder="1.2.3.4" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-mono" required />
                </div>
                <div className="w-32">
                  <label className="block text-xs text-gray-500 mb-1">פורט (אופציונלי)</label>
                  <input type="number" value={proxyForm.port} onChange={(e) => setProxyForm({ ...proxyForm, port: e.target.value })} placeholder="אוטו" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-mono" />
                </div>
                <div className="flex items-end">
                  <button type="submit" className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium">הוסף</button>
                </div>
              </form>

              <div className="space-y-2">
                {servers.find(s => s.id === selectedServer.id)?.proxyIps?.map(proxy => (
                  <div key={proxy.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                    <span className="font-mono text-gray-700">{proxy.ip}:{proxy.port}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">{proxy.phones?.length || 0} טלפונים</span>
                      <button onClick={() => handleDeleteProxy(selectedServer.id, proxy.id)} className="text-red-500 hover:text-red-700">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-gray-100">
              <button onClick={() => setShowProxyModal(false)} className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl">סגור</button>
            </div>
          </div>
        </div>
      )}

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl border border-gray-200 w-full max-w-lg shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-800">הוספת משתמש</h2>
            </div>
            {inviteLink ? (
              <div className="p-6">
                <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-6">
                  <p className="text-green-700 font-bold text-lg mb-3">משתמש נוצר!</p>
                  <p className="text-gray-600 text-sm mb-2">שלח את הלינק הבא למשתמש להשלמת ההרשמה:</p>
                  <div className="bg-white rounded-xl px-4 py-3 border font-mono text-sm break-all">{inviteLink}</div>
                </div>
                <button onClick={() => copyToClipboard(inviteLink, 'invite-link')} className={`w-full py-3 mb-3 font-semibold rounded-xl ${copied === 'invite-link' ? 'bg-green-500 text-white' : 'bg-indigo-500 text-white hover:bg-indigo-600'}`}>
                  {copied === 'invite-link' ? 'הועתק!' : 'העתק לינק'}
                </button>
                <button onClick={() => { setShowUserModal(false); setInviteLink(''); }} className="w-full py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl">סגור</button>
              </div>
            ) : (
              <form onSubmit={handleCreateUser} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">אימייל</label>
                  <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">תפקיד</label>
                  <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl">
                    <option value="viewer">צופה</option>
                    <option value="editor">עורך</option>
                    <option value="admin">מנהל</option>
                  </select>
                </div>
                <p className="text-sm text-gray-500">המשתמש יקבל לינק חד פעמי להגדרת סיסמה</p>
                <div className="flex gap-3 pt-4">
                  <button type="submit" className="flex-1 py-3.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl shadow-lg">צור</button>
                  <button type="button" onClick={() => setShowUserModal(false)} className="px-6 py-3.5 bg-gray-100 text-gray-700 font-semibold rounded-xl">ביטול</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Phone Modal */}
      {showPhoneModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl border border-gray-200 w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-800">ניהול טלפונים</h2>
              <p className="text-gray-500 font-mono">{selectedProxy?.ip}:{selectedProxy?.port}</p>
            </div>
            <div className="p-6">
              <form onSubmit={handleAddPhone} className="flex gap-2 mb-4">
                <input type="text" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="מספר טלפון" className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" required />
                <button type="submit" className="px-4 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium">הוסף</button>
              </form>
              
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {servers.flatMap(s => s.proxyIps).find(p => p.id === selectedProxy?.id)?.phones?.map(phone => (
                  <div key={phone.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                    <span className="text-gray-700">{phone.phone}</span>
                    <button onClick={() => handleRemovePhone(phone.id)} className="text-red-500 hover:text-red-700">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-gray-100">
              <button onClick={() => setShowPhoneModal(false)} className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl">סגור</button>
            </div>
          </div>
        </div>
      )}

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl border border-gray-200 w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-800">יצירת מפתח API</h2>
            </div>
            {selectedApiKey && !apiKeys.find(k => k.id === selectedApiKey.id) ? (
              <div className="p-6">
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4">
                  <p className="text-green-700 font-semibold mb-2">מפתח נוצר בהצלחה!</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                  <p className="font-mono text-sm break-all">{selectedApiKey.key}</p>
                </div>
                <button onClick={() => copyToClipboard(selectedApiKey.key, 'new-api-key')} className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl mb-3">
                  {copied === 'new-api-key' ? 'הועתק!' : 'העתק מפתח'}
                </button>
                <button onClick={() => { setShowApiKeyModal(false); setSelectedApiKey(null); }} className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl">סגור</button>
              </div>
            ) : (
              <form onSubmit={handleCreateApiKey} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">שם המפתח</label>
                  <input type="text" value={newApiKeyName} onChange={(e) => setNewApiKeyName(e.target.value)} placeholder="לדוגמה: Production API" className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl" />
                </div>
                <div className="flex gap-3">
                  <button type="submit" className="flex-1 py-3.5 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl">צור מפתח</button>
                  <button type="button" onClick={() => setShowApiKeyModal(false)} className="px-6 py-3.5 bg-gray-100 text-gray-700 font-semibold rounded-xl">ביטול</button>
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
                <button onClick={() => copyToClipboard(script, 'script')} className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition ${copied === 'script' ? 'bg-green-100 text-green-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                  {copied === 'script' ? 'הועתק!' : 'העתק'}
                </button>
                <button onClick={downloadScript} className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-xl">הורד</button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <textarea 
                value={script} 
                onChange={(e) => setScript(e.target.value)}
                className="w-full h-full min-h-[400px] text-sm text-gray-700 font-mono bg-gray-50 rounded-2xl p-6 border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                dir="ltr"
                spellCheck={false}
              />
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => handleShowScript(selectedServer)} className="px-6 py-3.5 bg-orange-100 hover:bg-orange-200 text-orange-700 font-semibold rounded-xl">איפוס</button>
              <button onClick={() => setShowScriptModal(false)} className="flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl">סגור</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
