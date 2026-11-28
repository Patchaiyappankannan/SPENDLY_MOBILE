import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useAuth } from './AuthContext';
import { syncNow } from '../services/sync';
import { pendingTxCount } from '../repositories/txRepo';
import { pendingBudgetCount } from '../repositories/budgetRepo';
import { getSetting } from '../repositories/settingsRepo';
import { syncPendingProfilePhoto } from '../services/profilePhoto';
import { generateDueExpenses } from '../repositories/recurringRepo';
import { rescheduleAllReminders } from '../repositories/reminderRepo';
import { registerRecurringBackgroundTask } from '../services/backgroundTasks';
import { pendingSavingsCount } from '../repositories/savingsRepo';
import { pendingLendBorrowCount } from '../repositories/lendBorrowRepo';
import { rescheduleModuleNotifications } from '../services/moduleNotifications';
import { pendingPreferencesCount } from '../repositories/preferencesRepo';

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
    setPending((await pendingTxCount()) + (await pendingBudgetCount()) + (await pendingSavingsCount()) + (await pendingLendBorrowCount()) + (await pendingPreferencesCount()));
    setLastSync(await getSetting('last_sync', ''));
  }, []);

  const run = useCallback(async () => {
    if (!user || busy.current) return;
    busy.current = true;
    setSyncing(true);
    const r = await syncNow();
    await syncPendingProfilePhoto();
    await rescheduleModuleNotifications();
    setSyncing(false);
    busy.current = false;
    if (r.error) setError(r.status === 401 ? 'Session expired. Sign out and sign in again.' : r.error);
    else if (r.ok) setError('');
    await refresh();
    if (r.ok) setVersion((v) => v + 1);
    return r;
  }, [user, refresh]);

  const maintainLocalSchedules = useCallback(async () => {
    if (!user) return;
    const generated = await generateDueExpenses();
    await rescheduleAllReminders();
    await rescheduleModuleNotifications();
    if (generated) setVersion((v) => v + 1);
  }, [user]);

  // Call after any local write: updates the badge and tries to sync right away.
  const changed = useCallback(async () => {
    setVersion((v) => v + 1);
    await refresh();
    run();
  }, [refresh, run]);

  useEffect(() => {
    if (!user) return;
    refresh();
    registerRecurringBackgroundTask().catch(() => {});
    maintainLocalSchedules().then(run).catch(() => {});
  }, [user, maintainLocalSchedules, run]);

  useEffect(() => {
    if (!user) return;
    const unsub = NetInfo.addEventListener((s) => { if (s.isConnected) run(); });
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') maintainLocalSchedules().then(run).catch(() => {});
    });
    return () => { unsub(); sub.remove(); };
  }, [user, run, maintainLocalSchedules]);

  return (
    <Ctx.Provider value={{ pending, syncing, lastSync, error, version, changed, syncNow: run }}>
      {children}
    </Ctx.Provider>
  );
}
export const useSync = () => useContext(Ctx);
