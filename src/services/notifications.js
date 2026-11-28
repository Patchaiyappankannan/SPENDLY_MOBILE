import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false,
  }),
});

export async function enableDailyReminder(hour = 21, minute = 0) {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return false;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('reminders', {
        name: 'Daily reminder', importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled
      .filter((item) => item.content.data?.kind === 'daily-log')
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Spendly', body: "Log today's expenses to keep your month on track.", data: { kind: 'daily-log' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: 'reminders' },
    });
    return true;
  } catch {
    return false;
  }
}

export async function cancelReminders() {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled
      .filter((item) => item.content.data?.kind === 'daily-log')
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));
  } catch {}
}
