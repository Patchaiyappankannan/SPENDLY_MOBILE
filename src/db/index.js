import * as SQLite from 'expo-sqlite';
import { migrate } from './migrate';
import { getActiveUserId } from '../services/activeUser';

let dbPromise;
let scopedUserId;
let scopePromise;

export function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('spendly.db');
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await migrate(db);
      return db;
    })();
  }
  return dbPromise.then(async (db) => {
    const userId = getActiveUserId();
    if (!userId || scopedUserId === userId) return db;

    if (!scopePromise) {
      scopePromise = db.withTransactionAsync(async () => {
        await db.runAsync('UPDATE transactions SET user_id=? WHERE user_id IS NULL', userId);
        await db.runAsync('UPDATE budgets SET user_id=? WHERE user_id IS NULL', userId);
        await db.runAsync(
          `INSERT OR IGNORE INTO user_meta (user_id, k, v)
           SELECT ?, k, v FROM meta
           WHERE k IN ('last_pull','last_sync','reminder_on','reminder_hour','reminder_minute',
             'profile_photo_data','profile_photo_mime','profile_photo_pending')`,
          userId,
        );
        await db.execAsync(`
          DELETE FROM meta WHERE k IN ('last_pull','last_sync','reminder_on','reminder_hour','reminder_minute',
            'profile_photo_data','profile_photo_mime','profile_photo_pending');
        `);
      }).then(() => { scopedUserId = userId; }).finally(() => { scopePromise = null; });
    }
    await scopePromise;
    return db;
  });
}

// Kept for explicit account-data removal; normal sign-out preserves user-scoped offline data.
export async function resetLocalData() {
  const db = await getDb();
  const userId = getActiveUserId();
  if (!userId) return;
  await db.runAsync('DELETE FROM transactions WHERE user_id=?', userId);
  await db.runAsync('DELETE FROM budgets WHERE user_id=?', userId);
  await db.runAsync('DELETE FROM user_meta WHERE user_id=?', userId);
}
