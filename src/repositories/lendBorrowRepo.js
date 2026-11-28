import * as Crypto from 'expo-crypto';
import { getDb } from '../db';
import { getActiveUserId } from '../services/activeUser';
import { cancelLendBorrowNotification, scheduleLendBorrowNotification } from '../services/moduleNotifications';

const now = () => new Date().toISOString();
const cents = (value) => Math.round(Number(value) * 100);
const today = () => new Date().toISOString().slice(0, 10);

function signedAmount(row) {
  const amount = cents(row.amount);
  if (row.type === 'lent') return amount;
  if (row.type === 'borrowed') return -amount;
  if (row.type === 'settle_received') return -amount;
  return amount;
}

async function getPersonBalanceCents(db, userId, personId) {
  const rows = await db.getAllAsync(`SELECT type,amount FROM lend_borrow_entries WHERE user_id=? AND person_id=? AND deleted=0`, userId, personId);
  return rows.reduce((sum, row) => sum + signedAmount(row), 0);
}

export async function listPeople(search = '') {
  const db = await getDb();
  const userId = getActiveUserId();
  const people = await db.getAllAsync(`SELECT * FROM persons WHERE user_id=? AND deleted=0 AND name LIKE ? ORDER BY name`, userId, `%${search.trim()}%`);
  const rows = await db.getAllAsync(`SELECT person_id,type,amount FROM lend_borrow_entries WHERE user_id=? AND deleted=0`, userId);
  const balances = new Map();
  for (const row of rows) balances.set(row.person_id, (balances.get(row.person_id) || 0) + signedAmount(row));
  return people.map((person) => ({ ...person, net_balance: (balances.get(person.id) || 0) / 100 }));
}

export async function getPerson(id) {
  const db = await getDb();
  const userId = getActiveUserId();
  const person = await db.getFirstAsync(`SELECT * FROM persons WHERE user_id=? AND id=? AND deleted=0`, userId, id);
  if (!person) return null;
  return { ...person, net_balance: (await getPersonBalanceCents(db, userId, id)) / 100 };
}

export async function savePerson(input, id) {
  const db = await getDb();
  const userId = getActiveUserId();
  const updatedAt = now();
  if (id) {
    await db.runAsync(`UPDATE persons SET name=?,phone=?,notes=?,updated_at=?,sync_status='pending' WHERE user_id=? AND id=? AND deleted=0`,
      input.name.trim(), input.phone || '', input.notes || '', updatedAt, userId, id);
  } else {
    id = Crypto.randomUUID();
    await db.runAsync(`INSERT INTO persons (user_id,id,name,phone,notes,updated_at,deleted,sync_status) VALUES (?,?,?,?,?,?,0,'pending')`,
      userId, id, input.name.trim(), input.phone || '', input.notes || '', updatedAt);
  }
  return id;
}

export async function deletePerson(id) {
  const db = await getDb();
  const userId = getActiveUserId();
  const open = await db.getFirstAsync(`SELECT id FROM lend_borrow_entries WHERE user_id=? AND person_id=? AND deleted=0 AND type IN ('lent','borrowed') AND status<>'settled' LIMIT 1`, userId, id);
  const balance = await getPersonBalanceCents(db, userId, id);
  if (open || balance !== 0) return false;
  await db.runAsync(`UPDATE persons SET deleted=1,updated_at=?,sync_status='pending' WHERE user_id=? AND id=?`, now(), userId, id);
  return true;
}

async function insertEntry(db, userId, input, id = Crypto.randomUUID(), splitGroupId = null) {
  const amountCents = cents(input.amount);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error('Enter an amount greater than zero');
  const timestamp = now();
  await db.runAsync(`INSERT INTO lend_borrow_entries (user_id,id,person_id,type,amount,date,due_date,account_id,parent_entry_id,split_group_id,status,note,proof_image,updated_at,deleted,sync_status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,'pending')`, userId, id, input.personId, input.type, amountCents / 100,
    input.date || today(), input.dueDate || null, input.accountId || '', input.parentEntryId || null, splitGroupId,
    input.type.startsWith('settle_') ? 'settled' : 'pending', input.note || '', input.proofImage || null, timestamp);
  return id;
}

export async function createEntry(input) {
  const db = await getDb();
  const userId = getActiveUserId();
  let createdId;
  let completedParentId = null;
  await db.withTransactionAsync(async () => {
    const person = await db.getFirstAsync('SELECT id FROM persons WHERE user_id=? AND id=? AND deleted=0', userId, input.personId);
    if (!person) throw new Error('Choose a person first');
    if (input.type === 'settle_received' || input.type === 'settle_paid') {
      if (!input.parentEntryId) throw new Error('Choose the loan or borrowing entry being settled');
      const parent = await db.getFirstAsync(`SELECT * FROM lend_borrow_entries WHERE user_id=? AND id=? AND person_id=? AND deleted=0`, userId, input.parentEntryId, input.personId);
      const expectedType = input.type === 'settle_received' ? 'lent' : 'borrowed';
      if (!parent || parent.type !== expectedType) throw new Error('Settlement type does not match the selected entry');
      const settled = await db.getFirstAsync(`SELECT COALESCE(SUM(amount),0) AS total FROM lend_borrow_entries WHERE user_id=? AND parent_entry_id=? AND deleted=0`, userId, parent.id);
      const remainingCents = cents(parent.amount) - cents(settled.total);
      if (cents(input.amount) > remainingCents) throw new Error('Settlement cannot exceed the remaining amount');
      createdId = await insertEntry(db, userId, input);
      const newSettled = cents(settled.total) + cents(input.amount);
      const status = newSettled >= cents(parent.amount) ? 'settled' : 'partially_settled';
      await db.runAsync(`UPDATE lend_borrow_entries SET status=?,updated_at=?,sync_status='pending' WHERE user_id=? AND id=?`, status, now(), userId, parent.id);
      if (status === 'settled') completedParentId = parent.id;
    } else {
      if (!['lent', 'borrowed'].includes(input.type)) throw new Error('Invalid entry type');
      createdId = await insertEntry(db, userId, input);
    }
  });
  if (completedParentId) await cancelLendBorrowNotification(completedParentId);
  const created = await db.getFirstAsync('SELECT * FROM lend_borrow_entries WHERE user_id=? AND id=?', userId, createdId);
  if (created) await scheduleLendBorrowNotification(created).catch(() => {});
  return createdId;
}

export async function createSplitBill({ totalAmount, myShare, people, date, accountId, note }) {
  const totalCents = cents(totalAmount);
  const ownCents = cents(myShare);
  const otherCents = people.reduce((sum, person) => sum + cents(person.amount), 0);
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0 || ownCents < 0 || ownCents + otherCents !== totalCents) {
    throw new Error('Your share and other people shares must add up exactly to the bill total');
  }
  if (people.some((person) => !person.personId || cents(person.amount) <= 0)) throw new Error('Every person needs a valid share greater than zero');
  const db = await getDb();
  const userId = getActiveUserId();
  const splitGroupId = Crypto.randomUUID();
  const timestamp = now();
  await db.withTransactionAsync(async () => {
    if (ownCents > 0) {
      await db.runAsync(`INSERT INTO transactions (user_id,local_id,type,amount,category,note,date,updated_at,deleted,sync_status,account)
        VALUES (?,?, 'expense',?,'Split bills',?,?,?,0,'pending',?)`, userId, Crypto.randomUUID(), ownCents / 100, note || 'My share', date || today(), timestamp, accountId || '');
    }
    for (const person of people) {
      const exists = await db.getFirstAsync('SELECT id FROM persons WHERE user_id=? AND id=? AND deleted=0', userId, person.personId);
      if (!exists) throw new Error('A selected person no longer exists');
      await insertEntry(db, userId, { personId: person.personId, type: 'lent', amount: cents(person.amount) / 100,
        date: date || today(), accountId, note: note || 'Split bill' }, Crypto.randomUUID(), splitGroupId);
    }
  });
  return splitGroupId;
}

export async function listPersonEntries(personId) {
  const db = await getDb();
  const rows = await db.getAllAsync(`SELECT e.*,
      CASE WHEN e.type IN ('lent','borrowed') THEN MAX(0,e.amount-COALESCE((SELECT SUM(s.amount) FROM lend_borrow_entries s WHERE s.user_id=e.user_id AND s.parent_entry_id=e.id AND s.deleted=0),0)) ELSE e.amount END AS remaining_amount
    FROM lend_borrow_entries e WHERE e.user_id=? AND e.person_id=? AND e.deleted=0 ORDER BY e.date DESC,e.created_at DESC`, getActiveUserId(), personId);
  return rows;
}

export async function listOverdueEntries() {
  const db = await getDb();
  return db.getAllAsync(`SELECT e.*,p.name AS person_name,
      MAX(0,e.amount-COALESCE((SELECT SUM(s.amount) FROM lend_borrow_entries s WHERE s.user_id=e.user_id AND s.parent_entry_id=e.id AND s.deleted=0),0)) AS remaining_amount
    FROM lend_borrow_entries e JOIN persons p ON p.user_id=e.user_id AND p.id=e.person_id
    WHERE e.user_id=? AND e.deleted=0 AND e.type IN ('lent','borrowed') AND e.status<>'settled' AND e.due_date IS NOT NULL AND e.due_date<?
      AND e.amount>COALESCE((SELECT SUM(s.amount) FROM lend_borrow_entries s WHERE s.user_id=e.user_id AND s.parent_entry_id=e.id AND s.deleted=0),0)
    ORDER BY e.due_date`,
  getActiveUserId(), today());
}

export async function getLendBorrowSummary(search = '') {
  const people = await listPeople(search);
  const receive = people.reduce((sum, person) => sum + Math.max(0, cents(person.net_balance)), 0);
  const pay = people.reduce((sum, person) => sum + Math.max(0, -cents(person.net_balance)), 0);
  return { people, totalToReceive: receive / 100, totalToPay: pay / 100, overdue: await listOverdueEntries() };
}

export async function getPendingPeople(limit = 200) {
  const db = await getDb();
  return db.getAllAsync(`SELECT * FROM persons WHERE user_id=? AND sync_status='pending' ORDER BY updated_at LIMIT ?`, getActiveUserId(), limit);
}
export async function getPendingLendBorrowEntries(limit = 200) {
  const db = await getDb();
  return db.getAllAsync(`SELECT * FROM lend_borrow_entries WHERE user_id=? AND sync_status='pending' ORDER BY updated_at LIMIT ?`, getActiveUserId(), limit);
}
export async function pendingLendBorrowCount() {
  const db = await getDb();
  const row = await db.getFirstAsync(`SELECT (SELECT COUNT(*) FROM persons WHERE user_id=? AND sync_status='pending') + (SELECT COUNT(*) FROM lend_borrow_entries WHERE user_id=? AND sync_status='pending') AS n`, getActiveUserId(), getActiveUserId());
  return row.n;
}
export async function markPeopleSynced(rows) { await markSynced('persons', rows); }
export async function markLendBorrowSynced(rows) { await markSynced('lend_borrow_entries', rows); }
async function markSynced(table, rows) {
  const db = await getDb();
  const userId = getActiveUserId();
  await db.withTransactionAsync(async () => {
    for (const row of rows) await db.runAsync(`UPDATE ${table} SET sync_status='synced' WHERE user_id=? AND id=? AND updated_at=?`, userId, row.id, row.updated_at);
  });
}

export async function applyServerLendBorrow(personRows = [], entryRows = []) {
  const db = await getDb();
  const userId = getActiveUserId();
  await db.withTransactionAsync(async () => {
    for (const row of personRows) {
      const local = await db.getFirstAsync('SELECT updated_at FROM persons WHERE user_id=? AND id=?', userId, row.id);
      if (local && local.updated_at >= row.updatedAt) continue;
      await db.runAsync(`INSERT OR REPLACE INTO persons (user_id,id,name,phone,notes,created_at,updated_at,deleted,sync_status)
        VALUES (?,?,?,?,?,?,?,?,'synced')`, userId, row.id, row.name, row.phone || '', row.notes || '', row.createdAt || row.updatedAt, row.updatedAt, row.deleted ? 1 : 0);
    }
    for (const row of entryRows) {
      const local = await db.getFirstAsync('SELECT updated_at,notification_id FROM lend_borrow_entries WHERE user_id=? AND id=?', userId, row.id);
      if (local && local.updated_at >= row.updatedAt) continue;
      await db.runAsync(`INSERT OR REPLACE INTO lend_borrow_entries (user_id,id,person_id,type,amount,date,due_date,account_id,parent_entry_id,split_group_id,status,note,proof_image,notification_id,created_at,updated_at,deleted,sync_status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'synced')`, userId, row.id, row.personId, row.type, row.amount, row.date, row.dueDate || null,
        row.accountId || '', row.parentEntryId || null, row.splitGroupId || null, row.status || 'pending', row.note || '', row.proofImage || null,
        local?.notification_id || null, row.createdAt || row.updatedAt, row.updatedAt, row.deleted ? 1 : 0);
    }
  });
}

export const personToWire = (r) => ({ id: r.id, name: r.name, phone: r.phone, notes: r.notes, createdAt: r.created_at,
  updatedAt: r.updated_at, deleted: !!r.deleted });
export const lendBorrowToWire = (r) => ({ id: r.id, personId: r.person_id, type: r.type, amount: r.amount, date: r.date,
  dueDate: r.due_date, accountId: r.account_id, parentEntryId: r.parent_entry_id, splitGroupId: r.split_group_id,
  status: r.status, note: r.note, proofImage: r.proof_image, createdAt: r.created_at, updatedAt: r.updated_at, deleted: !!r.deleted });