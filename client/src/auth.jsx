import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (email, password) => {
    const d = await api('/auth/login', { method: 'POST', body: { email, password } });
    setUser(d.user);
  }, []);
  const register = useCallback(async (name, email, password) => {
    const d = await api('/auth/register', { method: 'POST', body: { name, email, password } });
    setUser(d.user);
  }, []);
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    await api('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } });
  }, []);
  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, ready, login, register, changePassword, logout }}>{children}</Ctx.Provider>;
}
