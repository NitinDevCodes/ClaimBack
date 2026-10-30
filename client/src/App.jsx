import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import AuthPage from './pages/AuthPage';
import AccountPage from './pages/AccountPage';
import StatusPage from './pages/StatusPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  const location = useLocation();
  useEffect(() => {
    const titles = { '/': 'Find your way back', '/login': 'Log in', '/register': 'Create an account', '/account': 'My account', '/status': 'Service status' };
    document.title = `${titles[location.pathname] || 'Page not found'} · ClaimBack AI`;
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [location]);
  return <Routes><Route element={<Layout />}><Route index element={<HomePage />} /><Route path="login" element={<AuthPage mode="login" />} /><Route path="register" element={<AuthPage mode="register" />} /><Route path="status" element={<StatusPage />} /><Route element={<ProtectedRoute />}><Route path="account" element={<AccountPage />} /></Route><Route path="*" element={<NotFoundPage />} /></Route></Routes>;
}
