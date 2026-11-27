import * as Crypto from 'expo-crypto';
import { getDb } from '../db';
import { getActiveUserId } from '../services/activeUser';
import { monthKey, shiftMonth } from '../utils/format';

const now = () => new Date().toISOString();

export async function addTx({ type, amount, category, note, date, incomeFrequency }) {
  const db = await getDb();
  const userId = getActiveUserId();
  const id = Crypto.randomUUID();
  await db.runAsync(
    `INSERT INTO transactions (user_id,local_id,type,amount,category,note,date,income_frequency,updated_at,deleted,sync_status)
     VALUES (?,?,?,?,?,?,?,?,?,0,'pending')`,
    userId, id, type, amount, category, note || '', date, incomeFrequency, now()
  );
  return id;
}

export async function updateTx(id, { type, amount, category, note, date, incomeFrequency }) {
  const db = await getDb();
  const userId = getActiveUserId();
  await db.runAsync(
    `UPDATE transactions SET type=?,amount=?,category=?,note=?,date=?,income_frequency=?,updated_at=?,sync_status='pending'
     WHERE user_id=? AND local_id=?`,
    type, amount, category, note || '', date, incomeFrequency, now(), userId, id
  );
}

export async function deleteTx(id) {
  const db = await getDb();
  const userId = getActiveUserId();
  await db.runAsync(`UPDATE transactions SET deleted=1,updated_at=?,sync_status='pending' WHERE user_id=? AND local_id=?`, now(), userId, id);
}

export async function getTx(id) {
  const db = await getDb();
  const userId = getActiveUserId();
  return db.getFirstAsync('SELECT * FROM transactions WHERE user_id=? AND local_id=?', userId, id);
}

export async function listByMonth(month, { type, search, date } = {}) {
  const db = await getDb();
  const userId = getActiveUserId();
  let sql = `SELECT * FROM transactions WHERE user_id=? AND deleted=0 AND date ${date ? '= ?' : 'LIKE ?'}`;
  const args = [userId, date || month + '%'];
  if (type) { sql += ' AND type=?'; args.push(type); }
  if (search) { sql += ' AND (note LIKE ? OR category LIKE ?)'; args.push(`%${search}%`, `%${search}%`); }
  sql += ' ORDER BY date DESC, updated_at DESC';
  return db.getAllAsync(sql, ...args);
}

export async function monthSummary(month, date = null) {
  const db = await getDb();
  const userId = getActiveUserId();
  const rows = await db.getAllAsync(
    `SELECT type, SUM(amount) AS total FROM transactions WHERE user_id=? AND deleted=0 AND date ${date ? '= ?' : 'LIKE ?'} GROUP BY type`, userId, date || month + '%');
  const out = { income: 0, expense: 0 };
  rows.forEach((r) => { out[r.type] = r.total || 0; });
  return out;
}

export async function categoryTotals(month, type = 'expense', date = null) {
  const db = await getDb();
  const userId = getActiveUserId();
  return db.getAllAsync(
    `SELECT category, SUM(amount) AS total, COUNT(*) AS n FROM transactions
      WHERE user_id=? AND deleted=0 AND type=? AND date ${date ? '= ?' : 'LIKE ?'} GROUP BY category ORDER BY total DESC`, userId, type, date || month + '%');
}

export async function dailyTotals(month, type = 'income', date = null) {
  const db = await getDb();
  const userId = getActiveUserId();
  return db.getAllAsync(
    `SELECT date, SUM(amount) AS total, COUNT(*) AS n FROM transactions
      WHERE user_id=? AND deleted=0 AND type=? AND date ${date ? '= ?' : 'LIKE ?'} GROUP BY date ORDER BY date DESC`, userId, type, date || month + '%');
}

export async function monthlyTotals(endMonth = monthKey(new Date()), count = 6) {
  const db = await getDb();
  const userId = getActiveUserId();
  const months = Array.from({ length: count }, (_, i) => shiftMonth(endMonth, i - (count - 1)));
  const rows = await db.getAllAsync(
    `SELECT substr(date,1,7) AS m, type, SUM(amount) AS total FROM transactions
      WHERE user_id=? AND deleted=0 AND date >= ? AND date <= ? GROUP BY m, type`, userId, months[0] + '-01', endMonth + '-31');
  return months.map((m) => ({
    month: m,
    income: rows.find((r) => r.m === m && r.type === 'income')?.total || 0,
    expense: rows.find((r) => r.m === m && r.type === 'expense')?.total || 0,
  }));
}

export async function exportAll() {
  const db = await getDb();
  const userId = getActiveUserId();
  return db.getAllAsync(
    'SELECT local_id AS id, type, amount, category, note, date, income_frequency AS incomeFrequency FROM transactions WHERE user_id=? AND deleted=0 ORDER BY date DESC', userId);
}

// ----- sync helpers -----
export async function pendingTxCount() {
  const db = await getDb();
  const userId = getActiveUserId();
  return (await db.getFirstAsync(`SELECT COUNT(*) AS n FROM transactions WHERE user_id=? AND sync_status='pending'`, userId)).n;
}
export async function getPendingTx(limit = 200) {
  const db = await getDb();
  const userId = getActiveUserId();
  return db.getAllAsync(`SELECT * FROM transactions WHERE user_id=? AND sync_status='pending' ORDER BY updated_at LIMIT ?`, userId, limit);
}
// Mark synced only if the row was not edited again while the request was in flight.
export async function markTxSynced(rows) {
  const db = await getDb();
  const userId = getActiveUserId();
  await db.withTransactionAsync(async () => {
    for (const r of rows) {
      await db.runAsync(`UPDATE transactions SET sync_status='synced' WHERE user_id=? AND local_id=? AND updated_at=?`, userId, r.local_id, r.updated_at);
    }
  });
}
export async function applyServerTx(rows) {
  const db = await getDb();
  const userId = getActiveUserId();
  await db.withTransactionAsync(async () => {
    for (const r of rows) {
      const ex = await db.getFirstAsync('SELECT updated_at FROM transactions WHERE user_id=? AND local_id=?', userId, r.clientGuid);
      if (ex && r.updatedAt <= ex.updated_at) continue; // local copy is same or newer
      await db.runAsync(
        `INSERT OR REPLACE INTO transactions (user_id,local_id,type,amount,category,note,date,income_frequency,updated_at,deleted,sync_status)
         VALUES (?,?,?,?,?,?,?,?,?,?,'synced')`,
        userId, r.clientGuid, r.type, r.amount, r.category, r.note || '', r.date, r.incomeFrequency || null, r.updatedAt, r.deleted ? 1 : 0
      );
    }
  });
}
