import { getDb } from '../db';
import { getActiveUserId } from '../services/activeUser';

const now = () => new Date().toISOString();
const defaults = {
  requirePin: false,
  biometricEnabled: false,
  autoLockTimeout: 'immediate',
  dailyReminderEnabled: false,
  dailyReminderHour: 21,
  dailyReminderMinute: 0,
};

function fromRow(row) {
  return {
    requirePin: !!row.require_pin,
    biometricEnabled: !!row.biometric_enabled,
    autoLockTimeout: ['immediate', '1', '5'].includes(row.auto_lock_timeout) ? row.auto_lock_timeout : 'immediate',
    dailyReminderEnabled: !!row.daily_reminder_enabled,
    dailyReminderHour: Number(row.daily_reminder_hour),
    dailyReminderMinute: Number(row.daily_reminder_minute),
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
  };
}

export async function getUserPreferences(userId = getActiveUserId()) {
  if (!userId) return { ...defaults };
  const db = await getDb();
  let row = await db.getFirstAsync('SELECT * FROM user_preferences WHERE user_id=?', userId);
  if (!row) {
    const legacy = await db.getAllAsync(`SELECT k,v FROM user_meta WHERE user_id=? AND k IN ('reminder_on','reminder_hour','reminder_minute')`, userId);
    if (!legacy.length) return { ...defaults, updatedAt: null, syncStatus: 'synced' };
    const values = Object.fromEntries(legacy.map((item) => [item.k, item.v]));
    await db.runAsync(`INSERT OR IGNORE INTO user_preferences (user_id,require_pin,biometric_enabled,auto_lock_timeout,daily_reminder_enabled,daily_reminder_hour,daily_reminder_minute,updated_at,sync_status)
      VALUES (?,?,?,?,?,?,?,?, 'pending')`, userId, 0, 0, 'immediate', values.reminder_on === '1' ? 1 : 0,
      Number.isInteger(Number(values.reminder_hour)) ? Number(values.reminder_hour) : 21,
      Number.isInteger(Number(values.reminder_minute)) ? Number(values.reminder_minute) : 0, now());
    await db.runAsync(`DELETE FROM user_meta WHERE user_id=? AND k IN ('reminder_on','reminder_hour','reminder_minute')`, userId);
    row = await db.getFirstAsync('SELECT * FROM user_preferences WHERE user_id=?', userId);
  }
  return fromRow(row);
}

export async function hasUserPreferences(userId = getActiveUserId()) {
  if (!userId) return false;
  const db = await getDb();
  const row = await db.getFirstAsync('SELECT updated_at,sync_status FROM user_preferences WHERE user_id=?', userId);
  return !!row && (row.sync_status === 'pending' || row.updated_at > '1970-01-01T00:00:00.000Z');
}

export async function updateUserPreferences(patch, userId = getActiveUserId()) {
  if (!userId) throw new Error('Sign in before saving preferences.');
  const current = await getUserPreferences(userId);
  const next = { ...current, ...patch };
  next.requirePin = !!next.requirePin;
  next.biometricEnabled = !!next.biometricEnabled;
  next.dailyReminderEnabled = !!next.dailyReminderEnabled;
  next.autoLockTimeout = ['immediate', '1', '5'].includes(next.autoLockTimeout) ? next.autoLockTimeout : 'immediate';
  next.dailyReminderHour = Math.min(23, Math.max(0, Math.trunc(Number(next.dailyReminderHour) || 0)));
  next.dailyReminderMinute = Math.min(59, Math.max(0, Math.trunc(Number(next.dailyReminderMinute) || 0)));
  next.updatedAt = now();
  next.syncStatus = 'pending';
  const db = await getDb();
  await db.runAsync(`INSERT OR REPLACE INTO user_preferences (user_id,require_pin,biometric_enabled,auto_lock_timeout,daily_reminder_enabled,daily_reminder_hour,daily_reminder_minute,updated_at,sync_status)
    VALUES (?,?,?,?,?,?,?,?, 'pending')`, userId, next.requirePin ? 1 : 0, next.biometricEnabled ? 1 : 0,
    next.autoLockTimeout, next.dailyReminderEnabled ? 1 : 0, next.dailyReminderHour, next.dailyReminderMinute, next.updatedAt);
  return next;
}

export async function getPendingPreferences() {
  const db = await getDb();
  return db.getFirstAsync(`SELECT * FROM user_preferences WHERE user_id=? AND sync_status='pending'`, getActiveUserId());
}

export async function pendingPreferencesCount() {
  const db = await getDb();
  const row = await db.getFirstAsync(`SELECT COUNT(*) AS n FROM user_preferences WHERE user_id=? AND sync_status='pending'`, getActiveUserId());
  return Number(row?.n || 0);
}

export async function markPreferencesSynced(row) {
  if (!row) return;
  const db = await getDb();
  await db.runAsync(`UPDATE user_preferences SET sync_status='synced' WHERE user_id=? AND updated_at=?`, getActiveUserId(), row.updated_at);
}

export async function applyServerPreferences(remote) {
  if (!remote?.updatedAt) return false;
  const userId = getActiveUserId();
  const db = await getDb();
  const local = await db.getFirstAsync('SELECT updated_at FROM user_preferences WHERE user_id=?', userId);
  if (local && local.updated_at >= remote.updatedAt) return false;
  await db.runAsync(`INSERT OR REPLACE INTO user_preferences (user_id,require_pin,biometric_enabled,auto_lock_timeout,daily_reminder_enabled,daily_reminder_hour,daily_reminder_minute,updated_at,sync_status)
    VALUES (?,?,?,?,?,?,?,?, 'synced')`, userId, remote.requirePin ? 1 : 0, remote.biometricEnabled ? 1 : 0,
    ['immediate', '1', '5'].includes(remote.autoLockTimeout) ? remote.autoLockTimeout : 'immediate',
    remote.dailyReminderEnabled ? 1 : 0, Number.isInteger(Number(remote.dailyReminderHour)) ? Number(remote.dailyReminderHour) : 21,
    Number.isInteger(Number(remote.dailyReminderMinute)) ? Number(remote.dailyReminderMinute) : 0,
    remote.updatedAt);
  return true;
}

export const preferencesToWire = (row) => ({
  requirePin: !!row.require_pin,
  biometricEnabled: !!row.biometric_enabled,
  autoLockTimeout: row.auto_lock_timeout,
  dailyReminderEnabled: !!row.daily_reminder_enabled,
  dailyReminderHour: Number(row.daily_reminder_hour),
  dailyReminderMinute: Number(row.daily_reminder_minute),
  updatedAt: row.updated_at,
});
