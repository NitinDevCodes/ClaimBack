import { useState } from 'react';
import { CalendarDays, Check, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Button, ButtonLink, ErrorNotice, Field } from '../components/ui';
import { AppNav } from '../components/application';
import { errorMessage, fieldErrors } from '../lib/api';

export default function AccountPage() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const notify = useToast();
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setErrors({});
    try { await updateProfile({ name }); notify('Your profile has been updated.'); }
    catch (failure) { setError(errorMessage(failure)); setErrors(fieldErrors(failure)); }
    finally { setBusy(false); }
  }
  return <div className="container page-section account-page"><AppNav /><div className="page-heading"><p className="eyebrow">YOUR SPACE</p><h1>Welcome, {user.name.split(' ')[0]}.</h1><p>Keep your profile up to date. Your recovery workspace is ready when you are.</p></div><div className="account-grid"><aside className="panel account-summary"><div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div><h2>{user.name}</h2><span className="status-badge"><Check size={13} /> {user.role === 'admin' ? 'Administrator' : 'Member'}</span><dl><div><dt><Mail size={17} /> Email</dt><dd>{user.email}</dd></div><div><dt><CalendarDays size={17} /> Joined</dt><dd>{new Date(user.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</dd></div></dl><div className="subtle-note"><ShieldCheck size={18} /> Your account details are private.</div></aside><div className="account-content"><section className="panel"><div className="panel-title"><UserRound size={21} /><h2>Profile details</h2></div><p className="muted">Choose the name you’d like to use on ClaimBack.</p><form onSubmit={save} className="form-stack">{error && <ErrorNotice>{error}</ErrorNotice>}<Field id="profile-name" label="Full name" required autoComplete="name" minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} error={errors.name} /><Field id="profile-email" label="Email address" value={user.email} readOnly hint="Email changes will require a verification flow in a future release." /><Button loading={busy} disabled={name.trim() === user.name} type="submit">Save changes</Button></form></section><section className="foundation-panel"><span className="release-badge">YOUR RECOVERY WORKSPACE</span><h2>Make a connection.</h2><p>Manage your lost and found reports, review suggested matches, and track private ownership claims from your dashboard.</p><ButtonLink to="/dashboard" variant="outline">Open dashboard</ButtonLink></section></div></div></div>;
}
