import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, HeartHandshake, LockKeyhole } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Button, ErrorNotice, Field } from '../components/ui';
import { errorMessage, fieldErrors } from '../lib/api';

export default function AuthPage({ mode }) {
  const register = mode === 'register';
  const { user, authenticate } = useAuth();
  const notify = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { setError(''); setErrors({}); setValues({ name: '', email: '', password: '' }); }, [mode]);
  const requested = location.state?.from;
  const destination = typeof requested === 'string' && requested.startsWith('/') && !requested.startsWith('//') && !['/login', '/register'].includes(requested) ? requested : '/dashboard';
  if (user) return <Navigate to={destination} replace />;
  const change = (event) => setValues({ ...values, [event.target.name]: event.target.value });
  async function submit(event) {
    event.preventDefault();
    setError(''); setErrors({}); setBusy(true);
    try {
      await authenticate(mode, register ? values : { email: values.email, password: values.password });
      notify(register ? 'Your ClaimBack account is ready.' : 'Welcome back.');
      const from = location.state?.from;
      navigate(destination, { replace: true });
    } catch (failure) { setError(errorMessage(failure)); setErrors(fieldErrors(failure)); }
    finally { setBusy(false); }
  }
  return <div className="container auth-page"><aside className="auth-story"><Link to="/" className="back-link"><ArrowLeft size={17} /> Back to home</Link><div><span className="icon-tile"><HeartHandshake size={30} /></span><h1>Good things<br />find their<br /><em>way back.</em></h1><p>A little care can make a big difference.<br />Your ClaimBack story starts here.</p></div><span className="auth-story-bottom">LOST & FOUND, WITH A HUMAN TOUCH.</span></aside><section className="auth-form-panel"><span className="eyebrow">YOUR CLAIMBACK ACCOUNT</span><h2>{register ? 'A new connection starts here.' : 'Good to see you again.'}</h2><p className="muted">{register ? 'Create an account to report, match and recover items.' : 'Sign in to manage your account.'}</p>
    <form onSubmit={submit} className="form-stack" aria-label={register ? 'Create account' : 'Sign in'}>
      {error && <ErrorNotice>{error}</ErrorNotice>}
      {register && <Field id="name" name="name" label="Full name" placeholder="Alex Morgan" autoComplete="name" minLength={2} maxLength={80} required value={values.name} onChange={change} error={errors.name} />}
      <Field id="email" name="email" type="email" label="Email address" placeholder="you@example.com" autoComplete="email" maxLength={254} required value={values.email} onChange={change} error={errors.email} />
      <Field id="password" name="password" type="password" label="Password" placeholder={register ? 'Choose a strong password' : 'Enter your password'} autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 12 : 1} maxLength={72} hint={register ? 'At least 12 characters; no more than 72 UTF-8 bytes.' : undefined} required value={values.password} onChange={change} error={errors.password} />
      <Button loading={busy} type="submit">{register ? 'Create account' : 'Log in'}{!busy && <ArrowRight size={18} />}</Button>
    </form><p className="auth-switch">{register ? 'Already have an account?' : 'New to ClaimBack?'} <Link to={register ? '/login' : '/register'}>{register ? 'Log in' : 'Create an account'}</Link></p><div className="auth-security"><LockKeyhole size={15} /> Your password is protected with secure hashing.</div>
  </section></div>;
}
