import NetInfo from '@react-native-community/netinfo';
import { request } from './api';
import { getSetting, setSetting } from '../repositories/settingsRepo';
import { getPendingTx, markTxSynced, applyServerTx } from '../repositories/txRepo';
import { getPendingBudgets, markBudgetsSynced, applyServerBudgets } from '../repositories/budgetRepo';
import { getPendingRecurring, markRecurringSynced, applyServerRecurring, recurringToWire } from '../repositories/recurringRepo';
import { getPendingReminders, markRemindersSynced, applyServerReminders, reminderToWire } from '../repositories/reminderRepo';
import { rescheduleAllReminders } from '../repositories/reminderRepo';
import { getPendingGoals, getPendingContributions, markGoalsSynced, markContributionsSynced, applyServerGoals, goalToWire, contributionToWire } from '../repositories/savingsRepo';
import { getPendingPeople, getPendingLendBorrowEntries, markPeopleSynced, markLendBorrowSynced, applyServerLendBorrow, personToWire, lendBorrowToWire } from '../repositories/lendBorrowRepo';
import { getPendingPreferences, markPreferencesSynced, applyServerPreferences, preferencesToWire, getUserPreferences } from '../repositories/preferencesRepo';
import { enableDailyReminder, cancelReminders } from './notifications';

const toWire = (r) => ({
  clientGuid: r.local_id, type: r.type, amount: r.amount, category: r.category,
  note: r.note, date: r.date, incomeFrequency: r.income_frequency || null,
  recurringId: r.recurring_id || null, reminderId: r.reminder_id || null, account: r.account || '',
  recurringOccurrence: r.recurring_occurrence || null, reminderOccurrence: r.reminder_occurrence || null,
  deleted: !!r.deleted, updatedAt: r.updated_at,
});

let running = false;

/** Push pending local changes, then pull server changes. Safe to call any time, any number of times. */
export async function syncNow() {
  if (running) return { skipped: true };
  const net = await NetInfo.fetch();
  if (!net.isConnected || net.isInternetReachable === false) return { offline: true };
  running = true;
  try {
    for (let i = 0; i < 20; i++) {
      const tx = await getPendingTx(200);
      const bd = await getPendingBudgets();
      const recurring = await getPendingRecurring(200);
      const reminders = await getPendingReminders(200);
      const goals = await getPendingGoals(200);
      const contributions = await getPendingContributions(200);
      const people = await getPendingPeople(200);
      const lendBorrow = await getPendingLendBorrowEntries(200);
      const preferences = await getPendingPreferences();
      if (!tx.length && !bd.length && !recurring.length && !reminders.length && !goals.length && !contributions.length && !people.length && !lendBorrow.length && !preferences) break;
      await request('/sync/push', {
        method: 'POST',
        body: {
          transactions: tx.map(toWire),
          budgets: bd.map((b) => ({ month: b.month, amount: b.amount, updatedAt: b.updated_at })),
        },
      });
      if (recurring.length) {
        await request('/recurring/sync', { method: 'POST', body: { records: recurring.map(recurringToWire) } });
      }
      if (reminders.length) {
        await request('/reminders/sync', { method: 'POST', body: { records: reminders.map(reminderToWire) } });
      }
      if (goals.length || contributions.length) {
        await request('/goals/sync', { method: 'POST', body: { goals: goals.map(goalToWire), contributions: contributions.map(contributionToWire) } });
      }
      if (people.length || lendBorrow.length) {
        await request('/lendborrow/sync', { method: 'POST', body: { people: people.map(personToWire), entries: lendBorrow.map(lendBorrowToWire) } });
      }
      if (preferences) {
        await request('/preferences/sync', { method: 'POST', body: { preference: preferencesToWire(preferences) } });
      }
      await markTxSynced(tx);
      await markBudgetsSynced(bd);
      await markRecurringSynced(recurring);
      await markRemindersSynced(reminders);
      await markGoalsSynced(goals);
      await markContributionsSynced(contributions);
      await markPeopleSynced(people);
      await markLendBorrowSynced(lendBorrow);
      await markPreferencesSynced(preferences);
      if ([tx, recurring, reminders, goals, contributions, people, lendBorrow].every((rows) => rows.length < 200)) break;
    }
    const since = await getSetting('last_pull', '');
    const data = await request('/sync/pull' + (since ? `?since=${encodeURIComponent(since)}` : ''));
    await applyServerTx(data.transactions || []);
    await applyServerBudgets(data.budgets || []);
    const recurringSince = await getSetting('last_recurring_pull', '');
    const recurringData = await request('/recurring/sync' + (recurringSince ? `?lastSyncTime=${encodeURIComponent(recurringSince)}` : ''));
    await applyServerRecurring(recurringData.records || []);
    if (recurringData.cursor) await setSetting('last_recurring_pull', recurringData.cursor);
    const remindersSince = await getSetting('last_reminders_pull', '');
    const reminderData = await request('/reminders/sync' + (remindersSince ? `?lastSyncTime=${encodeURIComponent(remindersSince)}` : ''));
    await applyServerReminders(reminderData.records || []);
    await rescheduleAllReminders();
    if (reminderData.cursor) await setSetting('last_reminders_pull', reminderData.cursor);
    const goalsSince = await getSetting('last_goals_pull', '');
    const goalsData = await request('/goals/sync' + (goalsSince ? `?lastSyncTime=${encodeURIComponent(goalsSince)}` : ''));
    await applyServerGoals(goalsData.goals || [], goalsData.contributions || []);
    if (goalsData.cursor) await setSetting('last_goals_pull', goalsData.cursor);
    const lendBorrowSince = await getSetting('last_lendborrow_pull', '');
    const lendBorrowData = await request('/lendborrow/sync' + (lendBorrowSince ? `?lastSyncTime=${encodeURIComponent(lendBorrowSince)}` : ''));
    await applyServerLendBorrow(lendBorrowData.people || [], lendBorrowData.entries || []);
    if (lendBorrowData.cursor) await setSetting('last_lendborrow_pull', lendBorrowData.cursor);
    const preferencesSince = await getSetting('last_preferences_pull', '');
    const preferencesData = await request('/preferences/sync' + (preferencesSince ? `?lastSyncTime=${encodeURIComponent(preferencesSince)}` : ''));
    const preferencesChanged = preferencesData.preference ? await applyServerPreferences(preferencesData.preference) : false;
    if (preferencesData.cursor) await setSetting('last_preferences_pull', preferencesData.cursor);
    if (preferencesChanged) {
      const preferences = await getUserPreferences();
      if (preferences.dailyReminderEnabled) await enableDailyReminder(preferences.dailyReminderHour, preferences.dailyReminderMinute);
      else await cancelReminders();
    }
    if (data.cursor) await setSetting('last_pull', data.cursor);
    await setSetting('last_sync', new Date().toISOString());
    return { ok: true };
  } catch (e) {
    return { error: e.message, status: e.status };
  } finally {
    running = false;
  }
}
