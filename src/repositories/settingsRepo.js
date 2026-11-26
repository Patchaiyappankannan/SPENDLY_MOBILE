import { getDb } from '../db';
import { getActiveUserId } from '../services/activeUser';

const USER_SETTINGS = new Set([
  'last_pull', 'last_sync', 'reminder_on', 'reminder_hour', 'reminder_minute',
  'profile_photo_data', 'profile_photo_mime', 'profile_photo_pending',
]);

export async function getSetting(k, def = '') {
  const db = await getDb();
  if (USER_SETTINGS.has(k)) {
    const userId = getActiveUserId();
    if (!userId) return def;
    const r = await db.getFirstAsync('SELECT v FROM user_meta WHERE user_id=? AND k=?', userId, k);
    return r ? r.v : def;
  }
  const r = await db.getFirstAsync('SELECT v FROM meta WHERE k=?', k);
  return r ? r.v : def;
}
export async function setSetting(k, v) {
  const db = await getDb();
  if (USER_SETTINGS.has(k)) {
    const userId = getActiveUserId();
    if (!userId) throw new Error('Sign in before saving account settings.');
    await db.runAsync('INSERT OR REPLACE INTO user_meta (user_id, k, v) VALUES (?, ?, ?)', userId, k, String(v));
    return;
  }
  await db.runAsync('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)', k, String(v));
}
