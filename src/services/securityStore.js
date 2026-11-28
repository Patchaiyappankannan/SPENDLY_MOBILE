import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import { getDb } from '../db';
import { getActiveUserId } from './activeUser';
import { getUserPreferences, updateUserPreferences } from '../repositories/preferencesRepo';

const prefix = (userId) => `spendly.security.${String(userId)}.`;
const get = (userId, name, fallback = '') => SecureStore.getItemAsync(prefix(userId) + name).then((value) => value ?? fallback);
const put = (userId, name, value) => SecureStore.setItemAsync(prefix(userId) + name, String(value));

export async function getSecuritySettings(userId) {
  if (!userId) return { hasPin: false, enabled: false, biometricEnabled: false, timeout: 'immediate', pinLength: 4 };
  const migrationKey = await get(userId, 'preferences_db_migrated', '0');
  if (migrationKey !== '1') {
    const [legacyEnabled, legacyBiometric, legacyTimeout] = await Promise.all([
      get(userId, 'enabled'), get(userId, 'biometric'), get(userId, 'timeout'),
    ]);
    if (legacyEnabled || legacyBiometric || legacyTimeout) {
      await updateUserPreferences({
        ...(legacyEnabled ? { requirePin: legacyEnabled === '1' } : {}),
        ...(legacyBiometric ? { biometricEnabled: legacyBiometric === '1' } : {}),
        ...(legacyTimeout ? { autoLockTimeout: legacyTimeout } : {}),
      }, userId);
    }
    await Promise.all([
      SecureStore.deleteItemAsync(prefix(userId) + 'enabled'),
      SecureStore.deleteItemAsync(prefix(userId) + 'biometric'),
      SecureStore.deleteItemAsync(prefix(userId) + 'timeout'),
      put(userId, 'preferences_db_migrated', '1'),
    ]);
  }
  const [hash, salt, pinLength, preferences] = await Promise.all([
    get(userId, 'pin_hash'), get(userId, 'pin_salt'), get(userId, 'pin_length', '4'), getUserPreferences(userId),
  ]);
  return {
    hasPin: !!hash && !!salt,
    enabled: preferences.requirePin,
    biometricEnabled: preferences.biometricEnabled,
    timeout: preferences.autoLockTimeout,
    pinLength: Number(pinLength) === 6 ? 6 : 4,
  };
}

async function hashPin(salt, pin) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

export async function savePin(userId, pin) {
  if (!/^\d{4}(?:\d{2})?$/.test(pin)) throw new Error('PIN must contain 4 or 6 digits');
  const previous = await getSecuritySettings(userId);
  const salt = Crypto.randomUUID();
  const digest = await hashPin(salt, pin);
  await Promise.all([
    put(userId, 'pin_salt', salt), put(userId, 'pin_hash', digest), put(userId, 'pin_length', pin.length),
    put(userId, 'failed_attempts', '0'), put(userId, 'lock_until', '0'), put(userId, 'next_lock_ms', '30000'),
  ]);
  await updateUserPreferences({
    requirePin: true,
    biometricEnabled: previous.biometricEnabled,
    autoLockTimeout: previous.timeout,
  }, userId);
}

export async function verifyPin(userId, pin) {
  const lockUntil = Number(await get(userId, 'lock_until', '0'));
  if (lockUntil > Date.now()) return { ok: false, lockedUntil: lockUntil };
  const [salt, expectedHash] = await Promise.all([get(userId, 'pin_salt'), get(userId, 'pin_hash')]);
  if (!salt || !expectedHash) return { ok: false, missing: true };
  const actualHash = await hashPin(salt, pin);
  if (safeEqual(actualHash, expectedHash)) {
    await clearPinFailures(userId);
    return { ok: true };
  }
  const failedAttempts = Number(await get(userId, 'failed_attempts', '0')) + 1;
  if (failedAttempts >= 5) {
    const duration = Math.min(Number(await get(userId, 'next_lock_ms', '30000')), 60 * 60 * 1000);
    const until = Date.now() + duration;
    await Promise.all([
      put(userId, 'failed_attempts', '0'), put(userId, 'lock_until', until),
      put(userId, 'next_lock_ms', Math.min(duration * 2, 60 * 60 * 1000)),
    ]);
    return { ok: false, lockedUntil: until };
  }
  await put(userId, 'failed_attempts', failedAttempts);
  return { ok: false, attemptsRemaining: 5 - failedAttempts };
}

export async function getPinLockoutUntil(userId) {
  return Number(await get(userId, 'lock_until', '0'));
}

export async function clearPinFailures(userId) {
  await Promise.all([put(userId, 'failed_attempts', '0'), put(userId, 'lock_until', '0')]);
}

export async function clearPin(userId) {
  const names = ['pin_hash', 'pin_salt', 'pin_length', 'enabled', 'biometric', 'timeout', 'preferences_db_migrated', 'failed_attempts', 'lock_until', 'next_lock_ms'];
  await Promise.all(names.map((name) => SecureStore.deleteItemAsync(prefix(userId) + name)));
}

export async function setSecurityOption(userId, name, value) {
  const allowed = new Set(['enabled', 'biometric', 'timeout']);
  if (!allowed.has(name)) throw new Error('Unsupported security setting');
  if (name === 'timeout' && !['immediate', '1', '5'].includes(value)) throw new Error('Invalid auto-lock timeout');
  const field = name === 'enabled' ? 'requirePin' : name === 'biometric' ? 'biometricEnabled' : 'autoLockTimeout';
  await updateUserPreferences({ [field]: value }, userId);
}

export async function biometricAvailability() {
  const [hardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync(),
  ]);
  return { hardware, enrolled, available: hardware && enrolled };
}

export async function countUnsyncedRecords() {
  const db = await getDb();
  const userId = getActiveUserId();
  if (!userId) return 0;
  const tables = ['transactions', 'budgets', 'recurring_expenses', 'reminders', 'savings_goals', 'goal_contributions', 'persons', 'lend_borrow_entries'];
  const counts = await Promise.all(tables.map(async (table) => {
    const row = await db.getFirstAsync(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id=? AND sync_status='pending'`, userId);
    return Number(row?.n || 0);
  }));
  return counts.reduce((sum, count) => sum + count, 0);
}
