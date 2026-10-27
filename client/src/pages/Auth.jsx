import { useState } from 'react';
import { Link, useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

function safeNext(raw) {
  // Only allow same-site relative paths, to avoid open redirects.
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
}

function AuthForm({ mode }) {
  const { login, register, user } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const next = safeNext(sp.get('next'));
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isReg = mode === 'register';
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  if (user) return <Navigate to={next} replace />;

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isReg) await register(f.name, f.email, f.password);
      else await login(f.email, f.password);
      nav(next, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="authform">
      <h1 className="h-page">{isReg ? 'Create account' : 'Sign in'}</h1>
      {isReg && (
        <div className="field"><label htmlFor="name">Name</label><input id="name" value={f.name} onChange={set('name')} autoComplete="name" required maxLength={80} /></div>
      )}
      <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" value={f.email} onChange={set('email')} autoComplete="email" required /></div>
      <div className="field">
        <label htmlFor="pw">Password {isReg && <span className="muted">(8+ characters)</span>}</label>
        <input id="pw" type="password" value={f.password} onChange={set('password')} autoComplete={isReg ? 'new-password' : 'current-password'} required minLength={isReg ? 8 : 1} />
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn btn-block" disabled={busy}>{busy ? 'Please wait…' : isReg ? 'Create account' : 'Sign in'}</button>
      <p className="center small">
        {isReg ? <>Already have an account? <Link to={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link></> : <>New here? <Link to={`/register?next=${encodeURIComponent(next)}`}>Create an account</Link></>}
      </p>
    </form>
  );
}
export const Login = () => <AuthForm mode="login" />;
export const Register = () => <AuthForm mode="register" />;

export function Account() {
  const { user, ready, changePassword, logout } = useAuth();
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  if (!ready) return <p className="muted" role="status">Loading…</p>;
  if (!user) return <Navigate to="/login?next=/account" replace />;

  async function submitPasswordChange(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (passwords.next !== passwords.confirm) {
      setError('New passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await changePassword(passwords.current, passwords.next);
      setPasswords({ current: '', next: '', confirm: '' });
      setMessage('Password changed successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="h-page">Account</h1>
      <dl className="totals"><div><dt>Name</dt><dd>{user.name}</dd></div><div><dt>Email</dt><dd>{user.email}</dd></div></dl>
      {user.role === 'admin' && <p><Link to="/admin">Open admin dashboard</Link></p>}
      <form className="authform" onSubmit={submitPasswordChange}>
        <h2 className="h-sec">Change password</h2>
        <div className="field">
          <label htmlFor="current-password">Current password</label>
          <input id="current-password" type="password" autoComplete="current-password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} required />
        </div>
        <div className="field">
          <label htmlFor="new-password">New password <span className="muted">(8+ characters)</span></label>
          <input id="new-password" type="password" autoComplete="new-password" value={passwords.next} onChange={(e) => setPasswords({ ...passwords, next: e.target.value })} required minLength={8} maxLength={200} />
        </div>
        <div className="field">
          <label htmlFor="confirm-password">Confirm new password</label>
          <input id="confirm-password" type="password" autoComplete="new-password" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} required minLength={8} maxLength={200} />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}
        <button className="btn btn-block" disabled={busy}>{busy ? 'Please wait…' : 'Change password'}</button>
      </form>
      <button className="btn btn-ghost" onClick={logout}>Sign out</button>
    </>
  );
}
