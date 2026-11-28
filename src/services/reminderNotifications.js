import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { dueNotificationDate } from './recurrence';

export async function requestReminderPermission() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('bill-reminders', {
      name: 'Bill reminders', importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  await Notifications.setNotificationCategoryAsync('spendly-reminder', [
    { identifier: 'mark-paid', buttonTitle: 'Mark as Paid', options: { opensAppToForeground: true } },
  ]);
  return true;
}

export async function scheduleReminderNotification(reminder) {
  if (reminder.notification_id) {
    await Notifications.cancelScheduledNotificationAsync(reminder.notification_id).catch(() => {});
  }
  const triggerDate = dueNotificationDate(reminder.due_date, reminder.remind_before_days, reminder.notify_time);
  if (triggerDate.getTime() <= Date.now()) return null;
  if (!(await requestReminderPermission())) return null;
  return Notifications.scheduleNotificationAsync({
    content: {
      title: reminder.title,
      body: reminder.amount == null ? 'Payment due soon' : `Payment of ${reminder.amount} is due soon`,
      data: { reminderId: reminder.id },
      categoryIdentifier: 'spendly-reminder',
      ...(Platform.OS === 'android' ? { channelId: 'bill-reminders' } : {}),
    },
    trigger: triggerDate,
  });
}
