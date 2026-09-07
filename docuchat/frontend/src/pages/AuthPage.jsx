import { useState, useEffect } from 'react';
import { useAuth } from '../utils/AuthContext';
import { useFaceApi } from '../utils/useFaceApi';
import api from '../utils/api';
import './AuthPage.css';

export default function AuthPage() {
  const { login } = useAuth();
  const [mode, setMode] = useState('login'); // login | signup | face
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [facePhase, setFacePhase] = useState('intro'); // intro | scan | processing
  const [signupFacePhase, setSignupFacePhase] = useState('idle'); // idle | scan | captured
  const [signupFaceError, setSignupFaceError] = useState('');
  const [signupFaceDescriptor, setSignupFaceDescriptor] = useState(null);
  const [capturingFace, setCapturingFace] = useState(false);
  const { videoRef, status: camStatus, error: camError, initCamera, stopCamera, captureDescriptor } = useFaceApi();

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const handleModeChange = (m) => {
    setMode(m);
    setError('');
    setFacePhase('intro');
    setSignupFacePhase('idle');
    setSignupFaceError('');
    if (m !== 'face' && m !== 'signup') stopCamera();
  };

  const handleInput = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleLogin = async e => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data } = await api.post('/auth/login', { email: form.email, password: form.password });
      login(data.user, data.token);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally { setLoading(false); }
  };

  const handleSignup = async e => {
    e.preventDefault();
    if (!signupFaceDescriptor) {
      setError('Register your face before creating the account.');
      return;
    }
    setLoading(true); setError('');
    try {
      const payload = {
        name: form.name,
        email: form.email,
        password: form.password,
        faceDescriptor: signupFaceDescriptor
      };
      const { data } = await api.post('/auth/signup', payload);
      login(data.user, data.token);
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed');
    } finally { setLoading(false); }
  };

  const registerFace = async () => {
    setSignupFaceError('');
    setSignupFacePhase('scan');
    await initCamera();
  };

  const captureSignupFace = async () => {
    setCapturingFace(true);
    setSignupFaceError('');
    try {
      const descriptor = await captureDescriptor();
      setSignupFaceDescriptor(descriptor);
      setSignupFacePhase('captured');
      stopCamera();
    } catch (err) {
      setSignupFaceError(err.message || 'Could not capture your face');
    } finally {
      setCapturingFace(false);
    }
  };

  const startFaceScan = async () => {
    setFacePhase('scan');
    await initCamera();
  };

  const handleFaceLogin = async () => {
    setLoading(true); setError('');
    try {
      const descriptor = await captureDescriptor();
      stopCamera();
      setFacePhase('processing');
      const { data } = await api.post('/auth/face-login', { faceDescriptor: descriptor });
      login(data.user, data.token);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Face login failed');
      setFacePhase('intro');
      stopCamera();
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-root">
      {/* Background */}
      <div className="auth-bg">
        <div className="auth-bg-overlay" />
        <img
          src="https://images.unsplash.com/photo-1456324504439-367cee3b3c32?w=2200&q=85&auto=format&fit=crop"
          alt=""
          className="auth-bg-img"
        />
      </div>

      {/* Card */}
      <div className="auth-card">
        <div className="auth-logo">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="10" fill="#10a37f"/>
            <path d="M10 18C10 13.582 13.582 10 18 10s8 3.582 8 8-3.582 8-8 8-8-3.582-8-8z" fill="white" fillOpacity="0.3"/>
            <path d="M18 13v5l3 3" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span>Lexara AI</span>
        </div>

        <div className="auth-tabs">
          {['login', 'signup', 'face'].map(m => (
            <button
              key={m}
              className={`auth-tab ${mode === m ? 'active' : ''}`}
              onClick={() => handleModeChange(m)}
            >
              {m === 'login' ? 'Sign In' : m === 'signup' ? 'Sign Up' : '🪪 Face ID'}
            </button>
          ))}
        </div>

        {error && <div className="auth-error">{error}</div>}

        {/* LOGIN */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="auth-form">
            <div className="auth-field">
              <label className="label">Email</label>
              <input className="input" type="email" name="email" placeholder="you@example.com"
                value={form.email} onChange={handleInput} required />
            </div>
            <div className="auth-field">
              <label className="label">Password</label>
              <input className="input" type="password" name="password" placeholder="••••••••"
                value={form.password} onChange={handleInput} required />
            </div>
            <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Sign In'}
            </button>
            <p className="auth-switch">
              No account? <span onClick={() => handleModeChange('signup')}>Sign up</span>
            </p>
          </form>
        )}

        {/* SIGNUP */}
        {mode === 'signup' && (
          <form onSubmit={handleSignup} className="auth-form">
            <div className="auth-field">
              <label className="label">Full Name</label>
              <input className="input" name="name" placeholder="Jane Doe"
                value={form.name} onChange={handleInput} required />
            </div>
            <div className="auth-field">
              <label className="label">Email</label>
              <input className="input" type="email" name="email" placeholder="you@example.com"
                value={form.email} onChange={handleInput} required />
            </div>
            <div className="auth-field">
              <label className="label">Password</label>
              <input className="input" type="password" name="password" placeholder="••••••••"
                value={form.password} onChange={handleInput} required minLength={6} />
            </div>
            {signupFacePhase === 'idle' && (
              <button className="btn btn-secondary" type="button" onClick={registerFace}>
                Register Face ID
              </button>
            )}
            {signupFacePhase === 'scan' && (
              <div className="face-scan">
                <div className="face-video-wrap">
                  <video ref={videoRef} className="face-video" autoPlay muted playsInline />
                  <div className="face-overlay"><div className="face-ring" /></div>
                  {camStatus === 'loading' && <div className="face-loading"><span className="spinner" /><span>Loading AI models...</span></div>}
                </div>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={captureSignupFace}
                  disabled={camStatus !== 'ready' || capturingFace}
                >
                  {camStatus === 'loading' ? 'Preparing camera...' : capturingFace ? 'Detecting face...' : 'Capture Face'}
                </button>
                {(camError || signupFaceError) && <div className="auth-error">{camError || signupFaceError}</div>}
              </div>
            )}
            {signupFacePhase === 'captured' && <div className="auth-success">Face ID registered</div>}
            <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Create Account'}
            </button>
            <p className="auth-switch">
              Have an account? <span onClick={() => handleModeChange('login')}>Sign in</span>
            </p>
          </form>
        )}

        {/* FACE ID */}
        {mode === 'face' && (
          <div className="auth-face">
            {facePhase === 'intro' && (
              <div className="face-intro">
                <div className="face-icon">
                  <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                    <circle cx="32" cy="32" r="28" stroke="#10a37f" strokeWidth="2" strokeDasharray="4 2"/>
                    <circle cx="24" cy="28" r="3" fill="#10a37f"/>
                    <circle cx="40" cy="28" r="3" fill="#10a37f"/>
                    <path d="M22 40c2.667 3 17.333 3 20 0" stroke="#10a37f" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <p>Sign in using your face. Make sure you're registered with Face ID.</p>
                <button className="btn btn-primary" onClick={startFaceScan}>
                  Start Face Scan
                </button>
              </div>
            )}

            {facePhase === 'scan' && (
              <div className="face-scan">
                <div className="face-video-wrap">
                  <video ref={videoRef} className="face-video" autoPlay muted playsInline />
                  <div className="face-overlay">
                    <div className="face-ring" />
                  </div>
                  {camStatus === 'loading' && (
                    <div className="face-loading">
                      <span className="spinner" />
                      <span>Loading AI models...</span>
                    </div>
                  )}
                  {camError && <div className="auth-error">{camError}</div>}
                </div>
                {camStatus === 'ready' && (
                  <button className="btn btn-primary" onClick={handleFaceLogin} disabled={loading}>
                    {loading ? <span className="spinner" /> : 'Authenticate'}
                  </button>
                )}
              </div>
            )}

            {facePhase === 'processing' && (
              <div className="face-intro">
                <span className="spinner" style={{ width: 40, height: 40 }} />
                <p>Verifying your identity...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
