import * as Crypto from 'expo-crypto';
import { getDb } from '../db';
import { getActiveUserId } from '../services/activeUser';
import { addPeriod, currentDateOnly } from '../services/recurrence';
import { scheduleReminderNotification } from '../services/reminderNotifications';

const now = () => new Date().toISOString();

export async function listReminders(status, search = '') {
  const db = await getDb();
  const userId = getActiveUserId();
  let sql = `SELECT * FROM reminders WHERE user_id=? AND deleted=0`;
  const args = [userId];
  if (status === 'done') { sql += ` AND status IN ('done','skipped')`; }
  else if (status === 'upcoming') { sql += ` AND status='pending' AND due_date>=?`; args.push(currentDateOnly()); }
  else if (status === 'overdue') { sql += ` AND status='pending' AND due_date<?`; args.push(currentDateOnly()); }
  if (search.trim()) { sql += ' AND (title LIKE ? OR type LIKE ? OR account LIKE ?)'; args.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`); }
  return db.getAllAsync(`${sql} ORDER BY due_date`, ...args);
}

export async function getReminder(id) {
  const db = await getDb();
  return db.getFirstAsync('SELECT * FROM reminders WHERE user_id=? AND id=?', getActiveUserId(), id);
}

export async function saveReminder(input, id) {
  const db = await getDb();
  const userId = getActiveUserId();
  const updatedAt = now();
  let reminderId = id;
  if (id) {
    const old = await getReminder(id);
    await db.runAsync(
      `UPDATE reminders SET title=?,type=?,amount=?,due_date=?,repeat_type=?,remind_before_days=?,notify_time=?,account=?,recurring_id=?,updated_at=?,sync_status='pending'
       WHERE user_id=? AND id=?`,
      input.title.trim(), input.type, input.amount ? Number(input.amount) : null, input.dueDate,
      input.repeatType, Number(input.remindBeforeDays), input.notifyTime, input.account || '', input.recurringId || null,
      updatedAt, userId, id,
    );
    if (old?.notification_id) await (await import('expo-notifications')).cancelScheduledNotificationAsync(old.notification_id).catch(() => {});
  } else {
    reminderId = Crypto.randomUUID();
    await db.runAsync(
      `INSERT INTO reminders (user_id,id,title,type,amount,due_date,repeat_type,remind_before_days,notify_time,account,recurring_id,status,updated_at,deleted,sync_status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,'pending',?,0,'pending')`,
      userId, reminderId, input.title.trim(), input.type, input.amount ? Number(input.amount) : null,
      input.dueDate, input.repeatType, Number(input.remindBeforeDays), input.notifyTime, input.account || '', input.recurringId || null, updatedAt,
    );
  }
  const reminder = await getReminder(reminderId);
  const notificationId = await scheduleReminderNotification(reminder);
  await db.runAsync(`UPDATE reminders SET notification_id=?,updated_at=?,sync_status='pending' WHERE user_id=? AND id=?`, notificationId, now(), userId, reminderId);
  return reminderId;
}

export async function deleteReminder(id) {
  const db = await getDb();
  const reminder = await getReminder(id);
  if (reminder?.notification_id) await (await import('expo-notifications')).cancelScheduledNotificationAsync(reminder.notification_id).catch(() => {});
  await db.runAsync(`UPDATE reminders SET deleted=1,status='skipped',updated_at=?,sync_status='pending' WHERE user_id=? AND id=?`, now(), getActiveUserId(), id);
}

export async function skipReminder(id) {
  const db = await getDb();
  const reminder = await getReminder(id);
  if (reminder?.notification_id) await (await import('expo-notifications')).cancelScheduledNotificationAsync(reminder.notification_id).catch(() => {});
  await db.runAsync(`UPDATE reminders SET status='skipped',notification_id=NULL,updated_at=?,sync_status='pending' WHERE user_id=? AND id=?`, now(), getActiveUserId(), id);
}

export async function completeReminder(id) {
  const db = await getDb();
  const userId = getActiveUserId();
  let repeatRow = null;
  await db.withTransactionAsync(async () => {
    const reminder = await getReminder(id);
    if (!reminder || reminder.deleted || reminder.status !== 'pending') return;
    if (reminder.amount != null) {
      const exists = await db.getFirstAsync('SELECT local_id FROM transactions WHERE user_id=? AND reminder_id=? AND reminder_occurrence=?', userId, id, reminder.due_date);
      if (!exists) {
        await db.runAsync(
          `INSERT INTO transactions (user_id,local_id,type,amount,category,note,date,updated_at,deleted,sync_status,reminder_id,account,reminder_occurrence)
           VALUES (?,?, 'expense',?,'Bills',?,?,?,0,'pending',?,?,?)`,
          userId, Crypto.randomUUID(), reminder.amount, reminder.title, reminder.due_date, now(), id, reminder.account || '', reminder.due_date,
        );
      }
    }
    if (reminder.repeat_type !== 'none') {
      let next = addPeriod(reminder.due_date, reminder.repeat_type, Number(reminder.due_date.slice(8, 10)));
      while (next <= currentDateOnly()) next = addPeriod(next, reminder.repeat_type, Number(reminder.due_date.slice(8, 10)));
      await db.runAsync(`UPDATE reminders SET due_date=?,status='pending',notification_id=NULL,updated_at=?,sync_status='pending' WHERE user_id=? AND id=?`, next, now(), userId, id);
      repeatRow = await getReminder(id);
    } else {
      if (reminder.notification_id) await (await import('expo-notifications')).cancelScheduledNotificationAsync(reminder.notification_id).catch(() => {});
      await db.runAsync(`UPDATE reminders SET status='done',notification_id=NULL,updated_at=?,sync_status='pending' WHERE user_id=? AND id=?`, now(), userId, id);
    }
  });
  if (repeatRow) {
    const notificationId = await scheduleReminderNotification(repeatRow);
    await db.runAsync(`UPDATE reminders SET notification_id=?,updated_at=?,sync_status='pending' WHERE user_id=? AND id=?`, notificationId, now(), userId, id);
  }
}

export async function rescheduleAllReminders() {
  const db = await getDb();
  const userId = getActiveUserId();
  const rows = await db.getAllAsync(`SELECT * FROM reminders WHERE user_id=? AND status='pending' AND deleted=0`, userId);
  for (const reminder of rows) {
    const notificationId = await scheduleReminderNotification(reminder);
    await db.runAsync(`UPDATE reminders SET notification_id=? WHERE user_id=? AND id=?`, notificationId, userId, reminder.id);
  }
}

export async function getUpcomingReminderCount() {
  const db = await getDb();
  const today = currentDateOnly();
  const nextWeek = (() => { const [y, m, d] = today.split('-').map(Number); const date = new Date(Date.UTC(y, m - 1, d + 7)); return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`; })();
  return db.getAllAsync(`SELECT * FROM reminders WHERE user_id=? AND status='pending' AND deleted=0 AND due_date>=? AND due_date<=? ORDER BY due_date`, getActiveUserId(), today, nextWeek);
}

export async function getPendingReminders(limit = 200) {
  const db = await getDb();
  return db.getAllAsync(`SELECT * FROM reminders WHERE user_id=? AND sync_status='pending' ORDER BY updated_at LIMIT ?`, getActiveUserId(), limit);
}

export async function markRemindersSynced(rows) {
  const db = await getDb();
  const userId = getActiveUserId();
  await db.withTransactionAsync(async () => {
    for (const row of rows) await db.runAsync(`UPDATE reminders SET sync_status='synced' WHERE user_id=? AND id=? AND updated_at=?`, userId, row.id, row.updated_at);
  });
}

export async function applyServerReminders(rows) {
  const db = await getDb();
  const userId = getActiveUserId();
  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      const local = await getReminder(row.id);
      if (local && local.updated_at >= row.updatedAt) continue;
      await db.runAsync(
        `INSERT OR REPLACE INTO reminders (user_id,id,title,type,amount,due_date,repeat_type,remind_before_days,notify_time,account,recurring_id,status,notification_id,updated_at,deleted,sync_status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'synced')`,
        userId, row.id, row.title, row.type, row.amount, row.dueDate, row.repeatType, row.remindBeforeDays,
        row.notifyTime, row.account || '', row.recurringId || null, row.status, null, row.updatedAt, row.deleted ? 1 : 0,
      );
    }
  });
}

export function reminderToWire(row) {
  return {
    id: row.id, title: row.title, type: row.type, amount: row.amount, dueDate: row.due_date,
    repeatType: row.repeat_type, remindBeforeDays: row.remind_before_days, notifyTime: row.notify_time,
    account: row.account, recurringId: row.recurring_id, status: row.status,
    deleted: !!row.deleted, updatedAt: row.updated_at,
  };
}
