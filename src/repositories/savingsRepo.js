import * as Crypto from 'expo-crypto';
import { getDb } from '../db';
import { getActiveUserId } from '../services/activeUser';
import { cancelGoalNotification, rescheduleModuleNotifications } from '../services/moduleNotifications';

const now = () => new Date().toISOString();
const cents = (value) => Math.round(Number(value) * 100);

export async function listGoals(status = 'all', search = '') {
  const db = await getDb();
  const args = [getActiveUserId()];
  let query = `SELECT g.*, COALESCE(SUM(CASE WHEN c.type='add' THEN c.amount ELSE -c.amount END),0) AS saved_amount
    FROM savings_goals g LEFT JOIN goal_contributions c ON c.user_id=g.user_id AND c.goal_id=g.id AND c.deleted=0
    WHERE g.user_id=? AND g.deleted=0`;
  if (search.trim()) { query += ' AND g.name LIKE ?'; args.push(`%${search.trim()}%`); }
  query += ' GROUP BY g.user_id,g.id ORDER BY CASE g.status WHEN \'active\' THEN 0 WHEN \'paused\' THEN 1 ELSE 2 END,g.target_date,g.name';
  const rows = await db.getAllAsync(query, ...args);
  return rows.map((goal) => ({ ...goal, status: Number(goal.saved_amount) >= Number(goal.target_amount) ? 'completed' : goal.status }))
    .filter((goal) => status === 'all' || goal.status === status);
}

export async function getGoal(id) {
  const db = await getDb();
  const goal = await db.getFirstAsync(`SELECT g.*, COALESCE(SUM(CASE WHEN c.type='add' THEN c.amount ELSE -c.amount END),0) AS saved_amount
    FROM savings_goals g LEFT JOIN goal_contributions c ON c.user_id=g.user_id AND c.goal_id=g.id AND c.deleted=0
    WHERE g.user_id=? AND g.id=? AND g.deleted=0 GROUP BY g.user_id,g.id`, getActiveUserId(), id);
  return goal ? { ...goal, status: Number(goal.saved_amount) >= Number(goal.target_amount) ? 'completed' : goal.status } : null;
}

export async function listGoalContributions(id) {
  const db = await getDb();
  return db.getAllAsync(`SELECT * FROM goal_contributions WHERE user_id=? AND goal_id=? AND deleted=0 ORDER BY date DESC,created_at DESC`, getActiveUserId(), id);
}

export async function saveGoal(input, id) {
  const db = await getDb();
  const userId = getActiveUserId();
  const updatedAt = now();
  if (id) {
    await db.runAsync(`UPDATE savings_goals SET name=?,target_amount=?,target_date=?,icon=?,color=?,status=?,notes=?,remind_monthly=?,notify_time=?,updated_at=?,sync_status='pending'
      WHERE user_id=? AND id=? AND deleted=0`, input.name.trim(), Number(input.targetAmount), input.targetDate || null,
      input.icon || 'flag', input.color || '#2F7A68', input.status || 'active', input.notes || '', input.remindMonthly ? 1 : 0,
      input.notifyTime || '09:00', updatedAt, userId, id);
  } else {
    id = Crypto.randomUUID();
    await db.runAsync(`INSERT INTO savings_goals (user_id,id,name,target_amount,target_date,icon,color,status,notes,remind_monthly,notify_time,updated_at,deleted,sync_status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,'pending')`, userId, id, input.name.trim(), Number(input.targetAmount), input.targetDate || null,
      input.icon || 'flag', input.color || '#2F7A68', input.status || 'active', input.notes || '', input.remindMonthly ? 1 : 0,
      input.notifyTime || '09:00', updatedAt);
    if (Number(input.startingAmount) > 0) {
      await addGoalContribution(id, { amount: input.startingAmount, type: 'add', accountId: input.accountId || '', date: input.startDate || new Date().toISOString().slice(0, 10), note: 'Starting balance' });
    }
  }
  const saved = await db.getFirstAsync(`SELECT COALESCE(SUM(CASE WHEN type='add' THEN amount ELSE -amount END),0) AS amount
    FROM goal_contributions WHERE user_id=? AND goal_id=? AND deleted=0`, userId, id);
  if (Number(saved.amount) >= Number(input.targetAmount)) {
    await db.runAsync(`UPDATE savings_goals SET status='completed' WHERE user_id=? AND id=?`, userId, id);
  }
  await rescheduleModuleNotifications();
  return id;
}

export async function addGoalContribution(goalId, input) {
  const amountCents = cents(input.amount);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error('Enter an amount greater than zero');
  const db = await getDb();
  const userId = getActiveUserId();
  const id = Crypto.randomUUID();
  const updatedAt = now();
  await db.withTransactionAsync(async () => {
    const goal = await db.getFirstAsync('SELECT * FROM savings_goals WHERE user_id=? AND id=? AND deleted=0', userId, goalId);
    if (!goal) throw new Error('Savings goal not found');
    const rows = await db.getAllAsync(`SELECT type,amount FROM goal_contributions WHERE user_id=? AND goal_id=? AND deleted=0`, userId, goalId);
    const savedCents = rows.reduce((total, row) => total + (row.type === 'add' ? cents(row.amount) : -cents(row.amount)), 0);
    if (input.type === 'withdraw' && amountCents > savedCents) throw new Error('Withdrawal cannot exceed the saved amount');
    await db.runAsync(`INSERT INTO goal_contributions (user_id,id,goal_id,account_id,amount,type,date,note,updated_at,deleted,sync_status)
      VALUES (?,?,?,?,?,?,?,?,?,0,'pending')`, userId, id, goalId, input.accountId || '', amountCents / 100,
      input.type, input.date || new Date().toISOString().slice(0, 10), input.note || '', updatedAt);
    const nextSaved = savedCents + (input.type === 'add' ? amountCents : -amountCents);
    const status = nextSaved >= cents(goal.target_amount) ? 'completed' : (goal.status === 'completed' ? 'active' : goal.status);
    await db.runAsync(`UPDATE savings_goals SET status=?,updated_at=?,sync_status='pending' WHERE user_id=? AND id=?`, status, updatedAt, userId, goalId);
  });
  await rescheduleModuleNotifications();
  return id;
}

export async function deleteGoal(id) {
  const db = await getDb();
  await cancelGoalNotification(id);
  await db.runAsync(`UPDATE savings_goals SET deleted=1,updated_at=?,sync_status='pending' WHERE user_id=? AND id=?`, now(), getActiveUserId(), id);
  await rescheduleModuleNotifications();
}

export async function getSavingsSummary() {
  const goals = await listGoals('all');
  const savedCents = goals.reduce((sum, goal) => sum + cents(goal.saved_amount), 0);
  const top = [...goals].sort((a, b) => (Number(b.saved_amount) / Number(b.target_amount)) - (Number(a.saved_amount) / Number(a.target_amount)))[0] || null;
  return { totalSaved: savedCents / 100, topGoal: top };
}

export async function getPendingGoals(limit = 200) {
  const db = await getDb();
  return db.getAllAsync(`SELECT * FROM savings_goals WHERE user_id=? AND sync_status='pending' ORDER BY updated_at LIMIT ?`, getActiveUserId(), limit);
}
export async function getPendingContributions(limit = 200) {
  const db = await getDb();
  return db.getAllAsync(`SELECT * FROM goal_contributions WHERE user_id=? AND sync_status='pending' ORDER BY updated_at LIMIT ?`, getActiveUserId(), limit);
}
export async function pendingSavingsCount() {
  const db = await getDb();
  const row = await db.getFirstAsync(`SELECT (SELECT COUNT(*) FROM savings_goals WHERE user_id=? AND sync_status='pending') + (SELECT COUNT(*) FROM goal_contributions WHERE user_id=? AND sync_status='pending') AS n`, getActiveUserId(), getActiveUserId());
  return row.n;
}
export async function markGoalsSynced(rows) { await markSynced('savings_goals', rows, 'id'); }
export async function markContributionsSynced(rows) { await markSynced('goal_contributions', rows, 'id'); }
async function markSynced(table, rows, key) {
  const db = await getDb();
  const userId = getActiveUserId();
  await db.withTransactionAsync(async () => {
    for (const row of rows) await db.runAsync(`UPDATE ${table} SET sync_status='synced' WHERE user_id=? AND ${key}=? AND updated_at=?`, userId, row.id, row.updated_at);
  });
}

export async function applyServerGoals(goals = [], contributions = []) {
  const db = await getDb();
  const userId = getActiveUserId();
  await db.withTransactionAsync(async () => {
    for (const row of goals) {
      const local = await db.getFirstAsync('SELECT updated_at,notification_id FROM savings_goals WHERE user_id=? AND id=?', userId, row.id);
      if (local && local.updated_at >= row.updatedAt) continue;
      await db.runAsync(`INSERT OR REPLACE INTO savings_goals (user_id,id,name,target_amount,target_date,icon,color,status,notes,remind_monthly,notify_time,notification_id,created_at,updated_at,deleted,sync_status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'synced')`, userId, row.id, row.name, row.targetAmount, row.targetDate || null, row.icon || 'flag',
        row.color || '#2F7A68', row.status || 'active', row.notes || '', row.remindMonthly ? 1 : 0, row.notifyTime || '09:00',
        local?.notification_id || null, row.createdAt || row.updatedAt, row.updatedAt, row.deleted ? 1 : 0);
    }
    for (const row of contributions) {
      const local = await db.getFirstAsync('SELECT updated_at FROM goal_contributions WHERE user_id=? AND id=?', userId, row.id);
      if (local && local.updated_at >= row.updatedAt) continue;
      await db.runAsync(`INSERT OR REPLACE INTO goal_contributions (user_id,id,goal_id,account_id,amount,type,date,note,created_at,updated_at,deleted,sync_status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,'synced')`, userId, row.id, row.goalId, row.accountId || '', row.amount, row.type, row.date,
        row.note || '', row.createdAt || row.updatedAt, row.updatedAt, row.deleted ? 1 : 0);
    }
  });
}

export const goalToWire = (r) => ({ id: r.id, name: r.name, targetAmount: r.target_amount, targetDate: r.target_date,
  icon: r.icon, color: r.color, status: r.status, notes: r.notes, remindMonthly: !!r.remind_monthly,
  notifyTime: r.notify_time, createdAt: r.created_at, updatedAt: r.updated_at, deleted: !!r.deleted });
export const contributionToWire = (r) => ({ id: r.id, goalId: r.goal_id, accountId: r.account_id, amount: r.amount,
  type: r.type, date: r.date, note: r.note, createdAt: r.created_at, updatedAt: r.updated_at, deleted: !!r.deleted });