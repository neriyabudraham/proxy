import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const [email, setEmail] = useState('office@neriyabudraham.co.il');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(null);
  const [showReset, setShowReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');

  useEffect(() => {
    if (user) navigate('/dashboard');
    checkSetup();
    loadGoogleClientId();
  }, [user]);

  useEffect(() => {
    if (googleClientId && !needsSetup) {
      loadGoogleScript();
    }
  }, [googleClientId, needsSetup]);

  const loadGoogleClientId = async () => {
    const res = await fetch('/api/auth/google-client-id');
    const data = await res.json();
    setGoogleClientId(data.clientId);
  };

  const loadGoogleScript = () => {
    if (document.getElementById('google-script')) return;
    
    const script = document.createElement('script');
    script.id = 'google-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initGoogle;
    document.body.appendChild(script);
  };

  const initGoogle = () => {
    if (!window.google || !googleClientId) return;
    
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: handleGoogleCallback
    });
    
    window.google.accounts.id.renderButton(
      document.getElementById('google-btn'),
      { theme: 'filled_black', size: 'large', width: '100%', text: 'signin_with', locale: 'he' }
    );
  };

  const handleGoogleCallback = async (response) => {
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ credential: response.credential })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Google login failed');
      }
      
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const checkSetup = async () => {
    const res = await fetch('/api/auth/check-setup');
    const data = await res.json();
    setNeedsSetup(data.needsSetup);
  };

  const handleSetup = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('הסיסמאות אינן תואמות');
      return;
    }
    if (newPassword.length < 8) {
      setError('הסיסמה חייבת להכיל לפחות 8 תווים');
      return;
    }

    setLoading(true);
    setError('');

    const res = await fetch('/api/auth/setup-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword })
    });

    if (res.ok) {
      setNeedsSetup(false);
    } else {
      setError('שגיאה בהגדרת סיסמה');
    }
    setLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch {
      setError('אימייל או סיסמה שגויים');
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    setResetSent(true);
    setLoading(false);
  };

  if (needsSetup === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyMDI0MmYiIGZpbGwtb3BhY2l0eT0iMC40Ij48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnY0em0wLTZoLTJ2LTRoMnY0em0tNiA2aC0ydi00aDJ2NHptMC02aC0ydi00aDJ2NHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20"></div>
      
      <div className="w-full max-w-md relative">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl blur-lg opacity-30"></div>
        <div className="relative bg-slate-800/90 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-slate-700/50">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">ניהול פרוקסי</h1>
            <p className="text-slate-400">
              {needsSetup ? 'הגדרת סיסמה ראשונית' : showReset ? 'איפוס סיסמה' : 'התחבר למערכת'}
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {needsSetup ? (
            <form onSubmit={handleSetup} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">אימייל מנהל</label>
                <input type="email" value={email} disabled className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-slate-400 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">סיסמה חדשה</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="לפחות 8 תווים" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">אימות סיסמה</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" required />
              </div>
              <button type="submit" disabled={loading} className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold rounded-xl transition shadow-lg shadow-blue-500/30 disabled:opacity-50">
                {loading ? 'מגדיר...' : 'הגדר סיסמה והתחבר'}
              </button>
            </form>
          ) : showReset ? (
            resetSent ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-slate-300 text-lg">קישור לאיפוס נשלח לאימייל</p>
                <button onClick={() => { setShowReset(false); setResetSent(false); }} className="mt-6 text-blue-400 hover:text-blue-300 font-medium">חזרה להתחברות</button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">אימייל</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" required />
                </div>
                <button type="submit" disabled={loading} className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold rounded-xl transition disabled:opacity-50">
                  {loading ? 'שולח...' : 'שלח קישור איפוס'}
                </button>
                <button type="button" onClick={() => setShowReset(false)} className="w-full py-3 text-slate-400 hover:text-white transition">חזרה להתחברות</button>
              </form>
            )
          ) : (
            <>
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">אימייל</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">סיסמה</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" required />
                </div>
                <button type="submit" disabled={loading} className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold rounded-xl transition shadow-lg shadow-blue-500/30 disabled:opacity-50">
                  {loading ? 'מתחבר...' : 'התחבר'}
                </button>
              </form>

              {googleClientId && (
                <>
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-600"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-slate-800 text-slate-400">או</span>
                    </div>
                  </div>
                  <div id="google-btn" className="flex justify-center"></div>
                </>
              )}

              <button onClick={() => setShowReset(true)} className="mt-6 w-full text-center text-sm text-slate-400 hover:text-blue-400 transition">שכחת סיסמה?</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
