import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useAuth } from './AuthContext';
import { syncNow } from '../services/sync';
import { pendingTxCount } from '../repositories/txRepo';
import { pendingBudgetCount } from '../repositories/budgetRepo';
import { getSetting } from '../repositories/settingsRepo';
import { syncPendingProfilePhoto } from '../services/profilePhoto';

const Ctx = createContext(null);

export function SyncProvider({ children }) {
  const { user } = useAuth();
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState('');
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0); // screens reload when this changes
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    setPending((await pendingTxCount()) + (await pendingBudgetCount()));
    setLastSync(await getSetting('last_sync', ''));
  }, []);

  const run = useCallback(async () => {
    if (!user || busy.current) return;
    busy.current = true;
    setSyncing(true);
    const r = await syncNow();
    await syncPendingProfilePhoto();
    setSyncing(false);
    busy.current = false;
    if (r.error) setError(r.status === 401 ? 'Session expired. Sign out and sign in again.' : r.error);
    else if (r.ok) setError('');
    await refresh();
    if (r.ok) setVersion((v) => v + 1);
    return r;
  }, [user, refresh]);

  // Call after any local write: updates the badge and tries to sync right away.
  const changed = useCallback(async () => {
    setVersion((v) => v + 1);
    await refresh();
    run();
  }, [refresh, run]);

  useEffect(() => { if (user) { refresh(); run(); } }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = NetInfo.addEventListener((s) => { if (s.isConnected) run(); });
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') run(); });
    return () => { unsub(); sub.remove(); };
  }, [user, run]);

  return (
    <Ctx.Provider value={{ pending, syncing, lastSync, error, version, changed, syncNow: run }}>
      {children}
    </Ctx.Provider>
  );
}
export const useSync = () => useContext(Ctx);
