import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Menu, RotateCcw, X, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { errorMessage } from '../lib/api';
import { Button } from './ui';

export function Brand() { return <Link to="/" className="brand" aria-label="ClaimBack AI home"><span className="brand-icon"><RotateCcw size={22} strokeWidth={2.5} /></span><span>claimback<span className="brand-ai">AI</span></span></Link>; }

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { user, logout } = useAuth();
  const notify = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => { setMenuOpen(false); if (!location.hash) window.scrollTo(0, 0); }, [location.pathname, location.hash]);
  useEffect(() => {
    const close = (event) => { if (event.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  async function signOut() {
    setSigningOut(true);
    try { await logout(); notify('You are signed out of all sessions.'); navigate('/'); }
    catch (error) { notify(errorMessage(error), 'error'); }
    finally { setSigningOut(false); }
  }
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header"><div className="container header-inner">
      <Brand />
      <button className="menu-toggle" aria-expanded={menuOpen} aria-controls="main-navigation" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
      <nav className={`navigation ${menuOpen ? 'is-open' : ''}`} id="main-navigation" aria-label="Main navigation">
        <NavLink to="/" end>Overview</NavLink><a href="/#how-it-works">How it works</a><a href="/#responsible-ai">Our approach</a>
        {user ? <><NavLink to="/account">My account</NavLink><Button variant="ghost" loading={signingOut} onClick={signOut}><LogOut size={16} /> Sign out</Button></> : <><NavLink to="/login" className="nav-login">Log in</NavLink><Link to="/register" className="button button-primary nav-cta">Get started <ArrowUpRight size={16} /></Link></>}
      </nav>
    </div></header>
    <main id="main" tabIndex={-1}><Outlet /></main>
    <footer className="site-footer"><div className="container footer-inner"><div><Brand /><p>Good things find their way back.</p></div><div className="footer-links"><Link to="/status">Service status</Link><a href="/#responsible-ai">Trust & privacy</a><span>© {new Date().getFullYear()} ClaimBack AI</span></div></div></footer>
  </>;
}
