const pad = (value) => String(value).padStart(2, '0');

export const dateOnly = (date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

export function addPeriod(value, frequency, dayOfMonth) {
  const [year, month, day] = value.split('-').map(Number);
  if (frequency === 'daily' || frequency === 'weekly') {
    const date = new Date(Date.UTC(year, month - 1, day + (frequency === 'weekly' ? 7 : 1)));
    return dateOnly(date);
  }
  if (frequency === 'monthly') {
    const target = new Date(Date.UTC(year, month, 1));
    const targetYear = target.getUTCFullYear();
    const targetMonth = target.getUTCMonth();
    const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    return dateOnly(new Date(Date.UTC(targetYear, targetMonth, Math.min(dayOfMonth || day, lastDay))));
  }
  const targetYear = year + 1;
  const lastDay = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  return dateOnly(new Date(Date.UTC(targetYear, month - 1, Math.min(dayOfMonth || day, lastDay))));
}

export function currentDateOnly() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function dueNotificationDate(dueDate, beforeDays, notifyTime) {
  const [year, month, day] = dueDate.split('-').map(Number);
  const [hour, minute] = notifyTime.split(':').map(Number);
  const local = new Date(year, month - 1, day - Number(beforeDays || 0), hour || 0, minute || 0, 0, 0);
  return local;
}