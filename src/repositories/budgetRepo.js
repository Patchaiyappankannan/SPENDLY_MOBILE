import { getDb } from '../db';
import { getActiveUserId } from '../services/activeUser';

// A budget carries forward: the latest budget set on or before the month is used.
export async function getBudget(month) {
  const db = await getDb();
  const userId = getActiveUserId();
  const r = await db.getFirstAsync('SELECT amount FROM budgets WHERE user_id=? AND month<=? ORDER BY month DESC LIMIT 1', userId, month);
  return r ? r.amount : null;
}
export async function setBudget(month, amount) {
  const db = await getDb();
  const userId = getActiveUserId();
  await db.runAsync(
    `INSERT OR REPLACE INTO budgets (user_id,month,amount,updated_at,sync_status) VALUES (?,?,?,?,'pending')`,
    userId, month, amount, new Date().toISOString());
}
export async function pendingBudgetCount() {
  const db = await getDb();
  const userId = getActiveUserId();
  return (await db.getFirstAsync(`SELECT COUNT(*) AS n FROM budgets WHERE user_id=? AND sync_status='pending'`, userId)).n;
}
export async function getPendingBudgets() {
  const db = await getDb();
  const userId = getActiveUserId();
  return db.getAllAsync(`SELECT * FROM budgets WHERE user_id=? AND sync_status='pending'`, userId);
}
export async function markBudgetsSynced(rows) {
  const db = await getDb();
  const userId = getActiveUserId();
  for (const r of rows) {
    await db.runAsync(`UPDATE budgets SET sync_status='synced' WHERE user_id=? AND month=? AND updated_at=?`, userId, r.month, r.updated_at);
  }
}
export async function applyServerBudgets(rows) {
  const db = await getDb();
  const userId = getActiveUserId();
  for (const r of rows) {
    const ex = await db.getFirstAsync('SELECT updated_at FROM budgets WHERE user_id=? AND month=?', userId, r.month);
    if (ex && r.updatedAt <= ex.updated_at) continue;
    await db.runAsync(`INSERT OR REPLACE INTO budgets (user_id,month,amount,updated_at,sync_status) VALUES (?,?,?,?,'synced')`,
      userId, r.month, r.amount, r.updatedAt);
  }
}
