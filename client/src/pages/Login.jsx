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
  };

  const handleGoogleLogin = () => {
    if (window.google) {
      window.google.accounts.id.prompt();
    }
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-pulse" style={{animationDelay: '2s'}}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" style={{animationDelay: '4s'}}></div>
      </div>
      
      <div className="w-full max-w-md relative">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-indigo-200/50 p-8 border border-white/50">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-300/50 transform hover:scale-105 transition-transform">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">ניהול פרוקסי</h1>
            <p className="text-gray-500 mt-2 text-lg">
              {needsSetup ? 'הגדרת סיסמה ראשונית' : showReset ? 'איפוס סיסמה' : 'ברוכים הבאים'}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-6 flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span>{error}</span>
            </div>
          )}

          {needsSetup ? (
            <form onSubmit={handleSetup} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">אימייל מנהל</label>
                <input type="email" value={email} disabled className="w-full px-4 py-3.5 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">סיסמה חדשה</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" placeholder="לפחות 8 תווים" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">אימות סיסמה</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" required />
              </div>
              <button type="submit" disabled={loading} className="w-full py-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-300/50 hover:shadow-indigo-400/50 disabled:opacity-50 transform hover:scale-[1.02]">
                {loading ? 'מגדיר...' : 'הגדר סיסמה והתחבר'}
              </button>
            </form>
          ) : showReset ? (
            resetSent ? (
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                  <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-gray-700 text-xl font-medium">קישור לאיפוס נשלח לאימייל</p>
                <p className="text-gray-500 mt-2">בדוק את תיבת הדואר שלך</p>
                <button onClick={() => { setShowReset(false); setResetSent(false); }} className="mt-6 text-indigo-600 hover:text-indigo-700 font-semibold">חזרה להתחברות</button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">אימייל</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" required />
                </div>
                <button type="submit" disabled={loading} className="w-full py-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-300/50 disabled:opacity-50">
                  {loading ? 'שולח...' : 'שלח קישור איפוס'}
                </button>
                <button type="button" onClick={() => setShowReset(false)} className="w-full py-3 text-gray-500 hover:text-gray-700 font-medium transition">חזרה להתחברות</button>
              </form>
            )
          ) : (
            <>
              {/* Google Login Button */}
              {googleClientId && (
                <button onClick={handleGoogleLogin} className="w-full mb-6 py-4 bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-xl font-medium text-gray-700 transition-all flex items-center justify-center gap-3 shadow-sm hover:shadow group">
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>התחברות עם Google</span>
                </button>
              )}

              {googleClientId && (
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-400">או התחבר עם אימייל</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">אימייל</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">סיסמה</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" required />
                </div>
                <button type="submit" disabled={loading} className="w-full py-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-300/50 hover:shadow-indigo-400/50 disabled:opacity-50 transform hover:scale-[1.02]">
                  {loading ? 'מתחבר...' : 'התחבר'}
                </button>
              </form>

              <button onClick={() => setShowReset(true)} className="mt-6 w-full text-center text-sm text-gray-500 hover:text-indigo-600 transition font-medium">שכחת סיסמה?</button>
            </>
          )}
        </div>
        
        {/* Footer */}
        <p className="text-center text-gray-400 text-sm mt-6">מערכת ניהול פרוקסי מאובטחת</p>
      </div>
    </div>
  );
}
