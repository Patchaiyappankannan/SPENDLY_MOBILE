import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getDb } from '../db';
import { getActiveUserId } from './activeUser';

const atNine = (date) => new Date(`${date}T09:00:00`);

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('money-goals', { name: 'Goals and repayments', importance: Notifications.AndroidImportance.DEFAULT });
}

export async function scheduleGoalNotification(goal) {
  const db = await getDb();
  if (goal.notification_id) await Notifications.cancelScheduledNotificationAsync(goal.notification_id).catch(() => {});
  if (!goal.remind_monthly || goal.status !== 'active') {
    await db.runAsync('UPDATE savings_goals SET notification_id=NULL WHERE user_id=? AND id=?', getActiveUserId(), goal.id);
    return null;
  }
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return null;
  await ensureChannel();
  const [hour, minute] = (goal.notify_time || '09:00').split(':').map(Number);
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: { title: `Add to ${goal.name}`, body: 'A small contribution keeps your savings goal moving.', data: { goalId: goal.id }, ...(Platform.OS === 'android' ? { channelId: 'money-goals' } : {}) },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.MONTHLY, day: 1, hour: Number.isFinite(hour) ? hour : 9, minute: Number.isFinite(minute) ? minute : 0 },
  });
  await db.runAsync('UPDATE savings_goals SET notification_id=? WHERE user_id=? AND id=?', notificationId, getActiveUserId(), goal.id);
  return notificationId;
}

export async function scheduleLendBorrowNotification(entry) {
  const db = await getDb();
  if (entry.notification_id) await Notifications.cancelScheduledNotificationAsync(entry.notification_id).catch(() => {});
  if (!entry.due_date || entry.status === 'settled' || !['lent', 'borrowed'].includes(entry.type)) {
    await db.runAsync('UPDATE lend_borrow_entries SET notification_id=NULL WHERE user_id=? AND id=?', getActiveUserId(), entry.id);
    return null;
  }
  const triggerDate = atNine(entry.due_date);
  if (triggerDate.getTime() <= Date.now()) {
    await db.runAsync('UPDATE lend_borrow_entries SET notification_id=NULL WHERE user_id=? AND id=?', getActiveUserId(), entry.id);
    return null;
  }
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return null;
  await ensureChannel();
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: { title: 'Payment due', body: entry.type === 'lent' ? 'A repayment is due.' : 'A borrowed amount is due for repayment.', data: { lendBorrowEntryId: entry.id, personId: entry.person_id }, ...(Platform.OS === 'android' ? { channelId: 'money-goals' } : {}) },
    trigger: triggerDate,
  });
  await db.runAsync('UPDATE lend_borrow_entries SET notification_id=? WHERE user_id=? AND id=?', notificationId, getActiveUserId(), entry.id);
  return notificationId;
}

export async function cancelGoalNotification(goalId) {
  const db = await getDb();
  const userId = getActiveUserId();
  const row = await db.getFirstAsync('SELECT notification_id FROM savings_goals WHERE user_id=? AND id=?', userId, goalId);
  if (row?.notification_id) await Notifications.cancelScheduledNotificationAsync(row.notification_id).catch(() => {});
  await db.runAsync('UPDATE savings_goals SET notification_id=NULL WHERE user_id=? AND id=?', userId, goalId);
}

export async function cancelLendBorrowNotification(entryId) {
  const db = await getDb();
  const userId = getActiveUserId();
  const row = await db.getFirstAsync('SELECT notification_id FROM lend_borrow_entries WHERE user_id=? AND id=?', userId, entryId);
  if (row?.notification_id) await Notifications.cancelScheduledNotificationAsync(row.notification_id).catch(() => {});
  await db.runAsync('UPDATE lend_borrow_entries SET notification_id=NULL WHERE user_id=? AND id=?', userId, entryId);
}

export async function rescheduleModuleNotifications() {
  const db = await getDb();
  const userId = getActiveUserId();
  if (!userId) return;
  const goals = await db.getAllAsync('SELECT * FROM savings_goals WHERE user_id=?', userId);
  for (const goal of goals) {
    if (goal.deleted) await cancelGoalNotification(goal.id);
    else await scheduleGoalNotification(goal).catch(() => {});
  }
  const entries = await db.getAllAsync(`SELECT * FROM lend_borrow_entries WHERE user_id=? AND type IN ('lent','borrowed')`, userId);
  for (const entry of entries) {
    if (entry.deleted || entry.status === 'settled') await cancelLendBorrowNotification(entry.id);
    else await scheduleLendBorrowNotification(entry).catch(() => {});
  }
}