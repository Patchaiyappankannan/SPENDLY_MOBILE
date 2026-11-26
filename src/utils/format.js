const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n) => String(n).padStart(2, '0');

export function formatMoney(n, cur = '₹') {
  const v = Number(n) || 0;
  const [i, d] = Math.abs(v).toFixed(2).split('.');
  let out;
  if (cur === '₹') {
    const last = i.slice(-3);
    const rest = i.slice(0, -3);
    out = (rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' : '') + last; // 12,34,567
  } else {
    out = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  return (v < 0 ? '-' : '') + cur + out + (d === '00' ? '' : '.' + d);
}

export const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const toDateStr = (d) => `${monthKey(d)}-${pad(d.getDate())}`;
export const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const shiftMonth = (key, n) => { const [y, m] = key.split('-').map(Number); return monthKey(new Date(y, m - 1 + n, 1)); };
export const monthLabel = (key) => { const [y, m] = key.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
export const monthShort = (key) => MONTHS[Number(key.split('-')[1]) - 1].slice(0, 3);
export const daysInMonth = (key) => { const [y, m] = key.split('-').map(Number); return new Date(y, m, 0).getDate(); };
export const shiftDay = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return toDateStr(d); };

export function friendlyDate(s) {
  const today = toDateStr(new Date());
  if (s === today) return 'Today';
  if (s === shiftDay(today, -1)) return 'Yesterday';
  const d = parseDate(s);
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

export function timeAgo(iso) {
  if (!iso) return 'Never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 1440)} d ago`;
}
