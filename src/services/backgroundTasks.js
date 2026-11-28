import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { generateDueExpenses } from '../repositories/recurringRepo';

const TASK_NAME = 'spendly-recurring-catch-up';

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    const generated = await generateDueExpenses();
    return generated ? BackgroundFetch.BackgroundFetchResult.NewData : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerRecurringBackgroundTask() {
  const status = await BackgroundFetch.getStatusAsync();
  if (status === BackgroundFetch.BackgroundFetchStatus.Denied || status === BackgroundFetch.BackgroundFetchStatus.Restricted) return false;
  if (!(await TaskManager.isTaskRegisteredAsync(TASK_NAME))) {
    await BackgroundFetch.registerTaskAsync(TASK_NAME, { minimumInterval: 60 * 60 * 24 });
  }
  return true;
}
