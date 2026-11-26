import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { request, getToken, setToken } from '../services/api';
import { setActiveUserId } from '../services/activeUser';
import { getSetting } from '../repositories/settingsRepo';
import { cancelReminders, enableDailyReminder } from '../services/notifications';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Offline start: token + profile live in secure storage, so the app opens without internet.
  useEffect(() => {
    (async () => {
      try {
        const tok = await getToken();
        const u = await SecureStore.getItemAsync('user');
        if (tok && u) {
          const parsed = JSON.parse(u);
          setActiveUserId(parsed.id);
          setUser(parsed);
        } else setActiveUserId(null);
      } catch {}
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        if ((await getSetting('reminder_on', '0')) !== '1') return;
        const hour = Number(await getSetting('reminder_hour', '21'));
        const minute = Number(await getSetting('reminder_minute', '0'));
        await enableDailyReminder(hour, minute);
      } catch {}
    })();
  }, [user]);

  const finish = async ({ token, user: u }) => {
    await setToken(token);
    await SecureStore.setItemAsync('user', JSON.stringify(u));
    setActiveUserId(u.id);
    setUser(u);
  };

  const signIn = async (email, password) =>
    finish(await request('/auth/login', { method: 'POST', auth: false, body: { email, password } }));

  const signUp = async (name, email, password) =>
    finish(await request('/auth/register', { method: 'POST', auth: false, body: { name, email, password } }));

  const signOut = async () => {
    await cancelReminders();
    await setToken('');
    await SecureStore.deleteItemAsync('user');
    setActiveUserId(null);
    setUser(null);
  };

  const updateName = async (name) => {
    const u = { ...user, name };
    setUser(u);
    await SecureStore.setItemAsync('user', JSON.stringify(u));
    try { await request('/auth/profile', { method: 'PUT', body: { name } }); } catch {}
  };

  return <Ctx.Provider value={{ user, loading, signIn, signUp, signOut, updateName }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
