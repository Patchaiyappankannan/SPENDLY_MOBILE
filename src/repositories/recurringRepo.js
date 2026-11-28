import * as Crypto from 'expo-crypto';
import { getDb } from '../db';
import { getActiveUserId } from '../services/activeUser';
import { addPeriod, currentDateOnly } from '../services/recurrence';
import { deleteReminder, saveReminder } from './reminderRepo';

const now = () => new Date().toISOString();
export async function listRecurring({ active, search = '' } = {}) {
  const db = await getDb();
  const userId = getActiveUserId();
  let sql = `SELECT * FROM recurring_expenses WHERE user_id=? AND deleted=0`;
  const args = [userId];
  if (active !== undefined) { sql += ' AND is_active=?'; args.push(active ? 1 : 0); }
  if (search.trim()) { sql += ' AND (title LIKE ? OR category LIKE ? OR account LIKE ?)'; args.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`); }
  return db.getAllAsync(`${sql} ORDER BY next_due_date, title`, ...args);
}

export async function getRecurring(id) {
  const db = await getDb();
  return db.getFirstAsync('SELECT * FROM recurring_expenses WHERE user_id=? AND id=?', getActiveUserId(), id);
}

export async function saveRecurring(input, id) {
  const db = await getDb();
  const userId = getActiveUserId();
  const updatedAt = now();
  const existingRule = id ? await getRecurring(id) : null;
  const values = [
    input.title.trim(), Number(input.amount), input.category, input.account || '', input.frequency,
    input.frequency === 'monthly' ? Number(input.dayOfMonth) : null, input.startDate,
    input.endDate || null, input.totalInstallments ? Number(input.totalInstallments) : null,
    Number(input.paidInstallments || 0), input.nextDueDate || existingRule?.next_due_date || input.startDate,
    input.autoAdd ? 1 : 0, input.isActive === false ? 0 : 1, input.notes || '', input.createReminder ? 1 : 0,
    updatedAt,
  ];
  if (id) {
    await db.runAsync(
      `UPDATE recurring_expenses SET title=?,amount=?,category=?,account=?,frequency=?,day_of_month=?,start_date=?,end_date=?,
       total_installments=?,paid_installments=?,next_due_date=?,auto_add=?,is_active=?,notes=?,create_reminder=?,updated_at=?,sync_status='pending'
       WHERE user_id=? AND id=?`, ...values, userId, id,
    );
  } else {
    id = Crypto.randomUUID();
    await db.runAsync(
      `INSERT INTO recurring_expenses (user_id,id,title,amount,category,account,frequency,day_of_month,start_date,end_date,
       total_installments,paid_installments,next_due_date,auto_add,is_active,notes,create_reminder,updated_at,deleted,sync_status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,'pending')`, userId, id, ...values,
    );
  }
  const saved = await getRecurring(id);
  const linked = await db.getFirstAsync(`SELECT id FROM reminders WHERE user_id=? AND recurring_id=? AND deleted=0 LIMIT 1`, userId, id);
  if (input.createReminder) {
    const repeatType = ['monthly', 'yearly'].includes(input.frequency) ? input.frequency : 'none';
    const reminderInput = {
      title: input.title, type: 'bill', amount: Number(input.amount), dueDate: saved.next_due_date,
      repeatType, remindBeforeDays: 0, notifyTime: '09:00', account: input.account || '', recurringId: id,
    };
    await saveReminder(reminderInput, linked?.id);
  } else if (linked?.id) {
    await deleteReminder(linked.id);
  }
  return id;
}

export async function setRecurringActive(id, active) {
  const db = await getDb();
  await db.runAsync(`UPDATE recurring_expenses SET is_active=?,updated_at=?,sync_status='pending' WHERE user_id=? AND id=?`, active ? 1 : 0, now(), getActiveUserId(), id);
}

export async function skipRecurringOccurrence(id) {
  const db = await getDb();
  const userId = getActiveUserId();
  await db.withTransactionAsync(async () => {
    const rule = await db.getFirstAsync('SELECT * FROM recurring_expenses WHERE user_id=? AND id=? AND deleted=0', userId, id);
    if (!rule) return;
    const anchorDay = rule.day_of_month || Number(rule.start_date.slice(8, 10));
    const next = addPeriod(rule.next_due_date, rule.frequency, anchorDay);
    const isActive = rule.end_date && next > rule.end_date ? 0
      : rule.total_installments && rule.paid_installments >= rule.total_installments ? 0 : rule.is_active;
    await db.runAsync(`UPDATE recurring_expenses SET next_due_date=?,is_active=?,updated_at=?,sync_status='pending' WHERE user_id=? AND id=?`, next, isActive, now(), userId, id);
  });
}

export async function deleteRecurring(id) {
  const db = await getDb();
  await db.runAsync(`UPDATE recurring_expenses SET deleted=1,is_active=0,updated_at=?,sync_status='pending' WHERE user_id=? AND id=?`, now(), getActiveUserId(), id);
}

async function createOccurrence(db, userId, rule, occurrence) {
  const existing = await db.getFirstAsync(
    'SELECT local_id FROM transactions WHERE user_id=? AND recurring_id=? AND recurring_occurrence=?',
    userId, rule.id, occurrence,
  );
  if (!existing) {
    await db.runAsync(
      `INSERT INTO transactions (user_id,local_id,type,amount,category,note,date,updated_at,deleted,sync_status,recurring_id,account,recurring_occurrence)
       VALUES (?,?, 'expense',?,?,?,?,?,0,'pending',?,?,?)`,
      userId, Crypto.randomUUID(), rule.amount, rule.category, rule.notes || rule.title, occurrence, now(), rule.id, rule.account || '', occurrence,
    );
  }
  const paid = Number(rule.paid_installments || 0) + 1;
  const anchorDay = rule.day_of_month || Number(rule.start_date.slice(8, 10));
  const next = addPeriod(occurrence, rule.frequency, anchorDay);
  const finished = (rule.total_installments && paid >= rule.total_installments) || (rule.end_date && next > rule.end_date);
  await db.runAsync(
    `UPDATE recurring_expenses SET paid_installments=?,next_due_date=?,is_active=?,updated_at=?,sync_status='pending' WHERE user_id=? AND id=?`,
    paid, next, finished ? 0 : rule.is_active, now(), userId, rule.id,
  );
  return !existing;
}

export async function generateDueExpenses(today = currentDateOnly()) {
  const db = await getDb();
  const userId = getActiveUserId();
  let generated = 0;
  await db.withTransactionAsync(async () => {
    const rules = await db.getAllAsync(`SELECT * FROM recurring_expenses WHERE user_id=? AND deleted=0 AND is_active=1 AND auto_add=1 AND next_due_date<=?`, userId, today);
    for (const rule of rules) {
      let due = rule.next_due_date;
      let paid = Number(rule.paid_installments || 0);
      while (due <= today && (!rule.end_date || due <= rule.end_date) && (!rule.total_installments || paid < rule.total_installments)) {
        const inserted = await createOccurrence(db, userId, { ...rule, paid_installments: paid }, due);
        if (inserted) generated += 1;
        paid += 1;
        due = addPeriod(due, rule.frequency, rule.day_of_month || Number(rule.start_date.slice(8, 10)));
      }
      const done = (rule.total_installments && paid >= rule.total_installments) || (rule.end_date && due > rule.end_date);
      await db.runAsync(
        `UPDATE recurring_expenses SET paid_installments=?,next_due_date=?,is_active=?,updated_at=?,sync_status='pending' WHERE user_id=? AND id=?`,
        paid, due, done ? 0 : rule.is_active, now(), userId, rule.id,
      );
    }
  });
  return generated;
}

export async function addDueOccurrence(id) {
  const db = await getDb();
  const userId = getActiveUserId();
  let added = false;
  await db.withTransactionAsync(async () => {
    const rule = await db.getFirstAsync('SELECT * FROM recurring_expenses WHERE user_id=? AND id=? AND deleted=0 AND is_active=1', userId, id);
    if (!rule || rule.next_due_date > currentDateOnly()) return;
    added = await createOccurrence(db, userId, rule, rule.next_due_date);
  });
  return added;
}

export async function getPendingRecurring(limit = 200) {
  const db = await getDb();
  return db.getAllAsync(`SELECT * FROM recurring_expenses WHERE user_id=? AND sync_status='pending' ORDER BY updated_at LIMIT ?`, getActiveUserId(), limit);
}

export async function markRecurringSynced(rows) {
  const db = await getDb();
  const userId = getActiveUserId();
  await db.withTransactionAsync(async () => {
    for (const row of rows) await db.runAsync(`UPDATE recurring_expenses SET sync_status='synced' WHERE user_id=? AND id=? AND updated_at=?`, userId, row.id, row.updated_at);
  });
}

export async function applyServerRecurring(rows) {
  const db = await getDb();
  const userId = getActiveUserId();
  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      const local = await getRecurring(row.id);
      if (local && local.updated_at >= row.updatedAt) continue;
      await db.runAsync(
        `INSERT OR REPLACE INTO recurring_expenses (user_id,id,title,amount,category,account,frequency,day_of_month,start_date,end_date,total_installments,paid_installments,next_due_date,auto_add,is_active,notes,create_reminder,updated_at,deleted,sync_status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'synced')`,
        userId, row.id, row.title, row.amount, row.category, row.account || '', row.frequency, row.dayOfMonth,
        row.startDate, row.endDate, row.totalInstallments, row.paidInstallments, row.nextDueDate,
        row.autoAdd ? 1 : 0, row.isActive ? 1 : 0, row.notes || '', row.createReminder ? 1 : 0,
        row.updatedAt, row.deleted ? 1 : 0,
      );
    }
  });
}

export function recurringToWire(row) {
  return {
    id: row.id, title: row.title, amount: row.amount, category: row.category, account: row.account,
    frequency: row.frequency, dayOfMonth: row.day_of_month, startDate: row.start_date, endDate: row.end_date,
    totalInstallments: row.total_installments, paidInstallments: row.paid_installments,
    nextDueDate: row.next_due_date, autoAdd: !!row.auto_add, isActive: !!row.is_active,
    notes: row.notes, createReminder: !!row.create_reminder, deleted: !!row.deleted, updatedAt: row.updated_at,
  };
}
