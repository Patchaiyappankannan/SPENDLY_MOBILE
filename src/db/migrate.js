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
