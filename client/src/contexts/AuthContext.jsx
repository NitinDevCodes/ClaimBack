import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, errorMessage } from '../lib/api';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true);
    setSessionError('');
    try { const { data } = await api.get('/auth/me'); setUser(data.data.user); }
    catch (error) { setUser(null); if (error.response?.status !== 401) setSessionError(errorMessage(error)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const id = api.interceptors.response.use((response) => response, (error) => {
      if (error.response?.status === 401 && !['/auth/login', '/auth/register'].includes(error.config?.url)) setUser(null);
      return Promise.reject(error);
    });
    return () => api.interceptors.response.eject(id);
  }, []);
  const authenticate = async (mode, values) => {
    const { data } = await api.post(`/auth/${mode}`, values);
    setUser(data.data.user);
    setSessionError('');
    return data.data.user;
  };
  const logout = async () => { await api.post('/auth/logout', {}); setUser(null); };
  const updateProfile = async (values) => {
    const { data } = await api.patch('/users/me', values);
    setUser(data.data.user);
    return data.data.user;
  };
  return <AuthContext.Provider value={{ user, loading, sessionError, refresh, authenticate, logout, updateProfile }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
