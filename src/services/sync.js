import NetInfo from '@react-native-community/netinfo';
import { request } from './api';
import { getSetting, setSetting } from '../repositories/settingsRepo';
import { getPendingTx, markTxSynced, applyServerTx } from '../repositories/txRepo';
import { getPendingBudgets, markBudgetsSynced, applyServerBudgets } from '../repositories/budgetRepo';

const toWire = (r) => ({
  clientGuid: r.local_id, type: r.type, amount: r.amount, category: r.category,
  note: r.note, date: r.date, incomeFrequency: r.income_frequency || null,
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
      if (!tx.length && !bd.length) break;
      await request('/sync/push', {
        method: 'POST',
        body: {
          transactions: tx.map(toWire),
          budgets: bd.map((b) => ({ month: b.month, amount: b.amount, updatedAt: b.updated_at })),
        },
      });
      await markTxSynced(tx);
      await markBudgetsSynced(bd);
      if (tx.length < 200) break;
    }
    const since = await getSetting('last_pull', '');
    const data = await request('/sync/pull' + (since ? `?since=${encodeURIComponent(since)}` : ''));
    await applyServerTx(data.transactions || []);
    await applyServerBudgets(data.budgets || []);
    if (data.cursor) await setSetting('last_pull', data.cursor);
    await setSetting('last_sync', new Date().toISOString());
    return { ok: true };
  } catch (e) {
    return { error: e.message, status: e.status };
  } finally {
    running = false;
  }
}
