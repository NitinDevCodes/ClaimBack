import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import AuthPage from './pages/AuthPage';
import AccountPage from './pages/AccountPage';
import StatusPage from './pages/StatusPage';
import NotFoundPage from './pages/NotFoundPage';
import ReportsPage from './pages/ReportsPage';
import ReportFormPage from './pages/ReportFormPage';
import ReportDetailPage from './pages/ReportDetailPage';
import DashboardPage from './pages/DashboardPage';
import ClaimsPage, { ClaimDetailPage } from './pages/ClaimsPage';
import NotificationsPage from './pages/NotificationsPage';
import AdminPage from './pages/AdminPage';

export default function App() {
  const location = useLocation();
  useEffect(() => {
    const titles = { '/': 'Find your way back', '/login': 'Log in', '/register': 'Create an account', '/account': 'My account', '/status': 'Service status' };
    document.title = `${titles[location.pathname] || (location.pathname.startsWith('/reports') ? 'Lost & found' : location.pathname.startsWith('/claims') ? 'Ownership claims' : location.pathname === '/admin' ? 'Administration' : location.pathname === '/notifications' ? 'Notifications' : 'Recovery workspace')} · ClaimBack AI`;
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [location]);
  return <Routes><Route element={<Layout />}><Route index element={<HomePage />} /><Route path="login" element={<AuthPage mode="login" />} /><Route path="register" element={<AuthPage mode="register" />} /><Route path="status" element={<StatusPage />} /><Route path="reports" element={<ReportsPage />} /><Route path="reports/:id" element={<ReportDetailPage />} /><Route element={<ProtectedRoute />}><Route path="account" element={<AccountPage />} /><Route path="dashboard" element={<DashboardPage />} /><Route path="my-reports" element={<ReportsPage mine />} /><Route path="reports/new" element={<ReportFormPage />} /><Route path="reports/:id/edit" element={<ReportFormPage />} /><Route path="claims" element={<ClaimsPage />} /><Route path="claims/:id" element={<ClaimDetailPage />} /><Route path="notifications" element={<NotificationsPage />} /></Route><Route element={<ProtectedRoute roles={['admin']} />}><Route path="admin" element={<AdminPage />} /></Route><Route path="*" element={<NotFoundPage />} /></Route></Routes>;
}
