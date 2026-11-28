// Versioned migrations using PRAGMA user_version.
// RULE: never edit an old entry. A schema change = append a new entry (v2, v3 ...).
// Fresh install runs all entries in order; an updated app only runs the new ones.
const MIGRATIONS = [
  // v1
  `CREATE TABLE IF NOT EXISTS transactions (
     local_id    TEXT PRIMARY KEY,            -- GUID, also sent to the server as ClientGuid
     type        TEXT NOT NULL,               -- 'expense' | 'income'
     amount      REAL NOT NULL,
     category    TEXT NOT NULL,
     note        TEXT DEFAULT '',
     date        TEXT NOT NULL,               -- YYYY-MM-DD
     updated_at  TEXT NOT NULL,               -- ISO, last-write-wins
     deleted     INTEGER DEFAULT 0,           -- soft delete so the delete can sync
     sync_status TEXT DEFAULT 'pending'       -- 'pending' | 'synced'
   );
   CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
   CREATE INDEX IF NOT EXISTS idx_tx_sync ON transactions(sync_status);
   CREATE TABLE IF NOT EXISTS budgets (
     month TEXT PRIMARY KEY, amount REAL NOT NULL,
     updated_at TEXT NOT NULL, sync_status TEXT DEFAULT 'pending'
   );
   CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);`,
  async (db) => {
    await db.execAsync(`
      ALTER TABLE transactions RENAME TO transactions_v1;
      CREATE TABLE transactions (
        user_id TEXT,
        local_id TEXT NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        note TEXT DEFAULT '',
        date TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted INTEGER DEFAULT 0,
        sync_status TEXT DEFAULT 'pending',
        PRIMARY KEY (user_id, local_id)
      );
      INSERT INTO transactions (user_id, local_id, type, amount, category, note, date, updated_at, deleted, sync_status)
        SELECT NULL, local_id, type, amount, category, note, date, updated_at, deleted, sync_status FROM transactions_v1;
      DROP TABLE transactions_v1;
      CREATE INDEX idx_tx_date ON transactions(date);
      CREATE INDEX idx_tx_sync ON transactions(sync_status);
      CREATE INDEX idx_tx_user_date ON transactions(user_id, date);
      CREATE INDEX idx_tx_user_sync ON transactions(user_id, sync_status);

      ALTER TABLE budgets RENAME TO budgets_v1;
      CREATE TABLE budgets (
        user_id TEXT,
        month TEXT NOT NULL,
        amount REAL NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT DEFAULT 'pending',
        PRIMARY KEY (user_id, month)
      );
      INSERT INTO budgets (user_id, month, amount, updated_at, sync_status)
        SELECT NULL, month, amount, updated_at, sync_status FROM budgets_v1;
      DROP TABLE budgets_v1;
      CREATE INDEX idx_budget_user_sync ON budgets(user_id, sync_status);
      CREATE TABLE IF NOT EXISTS user_meta (
        user_id TEXT NOT NULL,
        k TEXT NOT NULL,
        v TEXT,
        PRIMARY KEY (user_id, k)
      );
    `);
  },
  `ALTER TABLE transactions ADD COLUMN income_frequency TEXT;`,
  `ALTER TABLE transactions ADD COLUMN recurring_id TEXT;
   ALTER TABLE transactions ADD COLUMN reminder_id TEXT;
   ALTER TABLE transactions ADD COLUMN account TEXT;
   ALTER TABLE transactions ADD COLUMN recurring_occurrence TEXT;
  ALTER TABLE transactions ADD COLUMN reminder_occurrence TEXT;
   CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_recurring_occurrence
     ON transactions(user_id, recurring_id, recurring_occurrence)
     WHERE recurring_id IS NOT NULL AND recurring_occurrence IS NOT NULL;
   CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_reminder_occurrence
     ON transactions(user_id, reminder_id, reminder_occurrence)
     WHERE reminder_id IS NOT NULL AND reminder_occurrence IS NOT NULL;

   CREATE TABLE IF NOT EXISTS recurring_expenses (
     user_id TEXT NOT NULL,
     id TEXT NOT NULL,
     title TEXT NOT NULL,
     amount REAL NOT NULL,
     category TEXT NOT NULL,
     account TEXT NOT NULL DEFAULT '',
     frequency TEXT NOT NULL CHECK (frequency IN ('daily','weekly','monthly','yearly')),
     day_of_month INTEGER,
     start_date TEXT NOT NULL,
     end_date TEXT,
     total_installments INTEGER,
     paid_installments INTEGER NOT NULL DEFAULT 0,
     next_due_date TEXT NOT NULL,
     auto_add INTEGER NOT NULL DEFAULT 1,
     is_active INTEGER NOT NULL DEFAULT 1,
     notes TEXT NOT NULL DEFAULT '',
     create_reminder INTEGER NOT NULL DEFAULT 0,
     updated_at TEXT NOT NULL,
     deleted INTEGER NOT NULL DEFAULT 0,
     sync_status TEXT NOT NULL DEFAULT 'pending',
     PRIMARY KEY (user_id, id)
   );
   CREATE INDEX IF NOT EXISTS idx_recurring_due ON recurring_expenses(user_id, is_active, next_due_date);
   CREATE INDEX IF NOT EXISTS idx_recurring_sync ON recurring_expenses(user_id, sync_status);

   CREATE TABLE IF NOT EXISTS reminders (
     user_id TEXT NOT NULL,
     id TEXT NOT NULL,
     title TEXT NOT NULL,
     type TEXT NOT NULL CHECK (type IN ('bill','emi','credit_card','other')),
     amount REAL,
     due_date TEXT NOT NULL,
     repeat_type TEXT NOT NULL DEFAULT 'none' CHECK (repeat_type IN ('none','monthly','yearly')),
     remind_before_days INTEGER NOT NULL DEFAULT 0,
     notify_time TEXT NOT NULL DEFAULT '09:00',
     account TEXT NOT NULL DEFAULT '',
     recurring_id TEXT,
     status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','skipped')),
     notification_id TEXT,
     updated_at TEXT NOT NULL,
     deleted INTEGER NOT NULL DEFAULT 0,
     sync_status TEXT NOT NULL DEFAULT 'pending',
     PRIMARY KEY (user_id, id)
   );
   CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(user_id, status, due_date);
   CREATE INDEX IF NOT EXISTS idx_reminders_sync ON reminders(user_id, sync_status);`,
  `CREATE TABLE IF NOT EXISTS savings_goals (
     user_id TEXT NOT NULL,
     id TEXT NOT NULL,
     name TEXT NOT NULL,
     target_amount REAL NOT NULL CHECK (target_amount > 0),
     target_date TEXT,
     icon TEXT NOT NULL DEFAULT 'flag',
     color TEXT NOT NULL DEFAULT '#2F7A68',
     status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','paused')),
     notes TEXT NOT NULL DEFAULT '',
     remind_monthly INTEGER NOT NULL DEFAULT 0,
     notify_time TEXT NOT NULL DEFAULT '09:00',
     notification_id TEXT,
     created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
     updated_at TEXT NOT NULL,
     deleted INTEGER NOT NULL DEFAULT 0,
     sync_status TEXT NOT NULL DEFAULT 'pending',
     PRIMARY KEY (user_id, id)
   );
   CREATE INDEX IF NOT EXISTS idx_goals_status ON savings_goals(user_id, status, deleted);
   CREATE INDEX IF NOT EXISTS idx_goals_sync ON savings_goals(user_id, sync_status);

   CREATE TABLE IF NOT EXISTS goal_contributions (
     user_id TEXT NOT NULL,
     id TEXT NOT NULL,
     goal_id TEXT NOT NULL,
     account_id TEXT NOT NULL DEFAULT '',
     amount REAL NOT NULL CHECK (amount > 0),
     type TEXT NOT NULL CHECK (type IN ('add','withdraw')),
     date TEXT NOT NULL,
     note TEXT NOT NULL DEFAULT '',
     created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
     updated_at TEXT NOT NULL,
     deleted INTEGER NOT NULL DEFAULT 0,
     sync_status TEXT NOT NULL DEFAULT 'pending',
     PRIMARY KEY (user_id, id)
   );
   CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal ON goal_contributions(user_id, goal_id, date);
   CREATE INDEX IF NOT EXISTS idx_goal_contributions_sync ON goal_contributions(user_id, sync_status);

   CREATE TABLE IF NOT EXISTS persons (
     user_id TEXT NOT NULL,
     id TEXT NOT NULL,
     name TEXT NOT NULL,
     phone TEXT NOT NULL DEFAULT '',
     notes TEXT NOT NULL DEFAULT '',
     created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
     updated_at TEXT NOT NULL,
     deleted INTEGER NOT NULL DEFAULT 0,
     sync_status TEXT NOT NULL DEFAULT 'pending',
     PRIMARY KEY (user_id, id)
   );
   CREATE INDEX IF NOT EXISTS idx_persons_sync ON persons(user_id, sync_status);

   CREATE TABLE IF NOT EXISTS lend_borrow_entries (
     user_id TEXT NOT NULL,
     id TEXT NOT NULL,
     person_id TEXT NOT NULL,
     type TEXT NOT NULL CHECK (type IN ('lent','borrowed','settle_received','settle_paid')),
     amount REAL NOT NULL CHECK (amount > 0),
     date TEXT NOT NULL,
     due_date TEXT,
     account_id TEXT NOT NULL DEFAULT '',
     parent_entry_id TEXT,
     split_group_id TEXT,
     status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','partially_settled','settled')),
     note TEXT NOT NULL DEFAULT '',
     proof_image TEXT,
     notification_id TEXT,
     created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
     updated_at TEXT NOT NULL,
     deleted INTEGER NOT NULL DEFAULT 0,
     sync_status TEXT NOT NULL DEFAULT 'pending',
     PRIMARY KEY (user_id, id)
   );
   CREATE INDEX IF NOT EXISTS idx_lend_borrow_person ON lend_borrow_entries(user_id, person_id, date);
   CREATE INDEX IF NOT EXISTS idx_lend_borrow_due ON lend_borrow_entries(user_id, due_date, status, deleted);
   CREATE INDEX IF NOT EXISTS idx_lend_borrow_sync ON lend_borrow_entries(user_id, sync_status);
   CREATE INDEX IF NOT EXISTS idx_lend_borrow_parent ON lend_borrow_entries(user_id, parent_entry_id);`,
  `CREATE TABLE IF NOT EXISTS user_preferences (
     user_id TEXT PRIMARY KEY,
     require_pin INTEGER NOT NULL DEFAULT 0 CHECK (require_pin IN (0,1)),
     biometric_enabled INTEGER NOT NULL DEFAULT 0 CHECK (biometric_enabled IN (0,1)),
     auto_lock_timeout TEXT NOT NULL DEFAULT 'immediate' CHECK (auto_lock_timeout IN ('immediate','1','5')),
     daily_reminder_enabled INTEGER NOT NULL DEFAULT 0 CHECK (daily_reminder_enabled IN (0,1)),
     daily_reminder_hour INTEGER NOT NULL DEFAULT 21 CHECK (daily_reminder_hour BETWEEN 0 AND 23),
     daily_reminder_minute INTEGER NOT NULL DEFAULT 0 CHECK (daily_reminder_minute BETWEEN 0 AND 59),
     updated_at TEXT NOT NULL,
     sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending','synced'))
   );
   CREATE INDEX IF NOT EXISTS idx_user_preferences_sync ON user_preferences(sync_status);
   INSERT OR IGNORE INTO user_preferences (user_id,daily_reminder_enabled,daily_reminder_hour,daily_reminder_minute,updated_at,sync_status)
     SELECT user_id,
       CAST(COALESCE((SELECT v FROM user_meta m WHERE m.user_id=user_meta.user_id AND m.k='reminder_on'),'0') AS INTEGER),
       CAST(COALESCE((SELECT v FROM user_meta m WHERE m.user_id=user_meta.user_id AND m.k='reminder_hour'),'21') AS INTEGER),
       CAST(COALESCE((SELECT v FROM user_meta m WHERE m.user_id=user_meta.user_id AND m.k='reminder_minute'),'0') AS INTEGER),
       strftime('%Y-%m-%dT%H:%M:%fZ','now'),'pending'
     FROM user_meta GROUP BY user_id;
   DELETE FROM user_meta WHERE k IN ('reminder_on','reminder_hour','reminder_minute');`,
  `UPDATE user_preferences
     SET updated_at='1970-01-01T00:00:00.000Z',sync_status='synced'
   WHERE require_pin=0 AND biometric_enabled=0 AND auto_lock_timeout='immediate'
     AND daily_reminder_enabled=0 AND daily_reminder_hour=21 AND daily_reminder_minute=0;`,
];

export async function migrate(db) {
  const row = await db.getFirstAsync('PRAGMA user_version');
  const current = row ? row.user_version : 0;
  for (let v = current; v < MIGRATIONS.length; v++) {
    await db.withTransactionAsync(async () => {
      const migration = MIGRATIONS[v];
      if (typeof migration === 'function') await migration(db);
      else await db.execAsync(migration);
      await db.execAsync(`PRAGMA user_version = ${v + 1}`);
    });
  }
}
