import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "sarafi.db");

declare global {
  // eslint-disable-next-line no-var
  var __sarafiDb: Database.Database | undefined;
}

function createDb(): Database.Database {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initSchema(db);
  return db;
}

export function getDb(): Database.Database {
  if (!global.__sarafiDb) global.__sarafiDb = createDb();
  return global.__sarafiDb;
}

function initSchema(db: Database.Database) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    type TEXT DEFAULT 'customer',
    note TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS safes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'cash',
    account_no TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS currencies (
    code TEXT PRIMARY KEY,
    name_fa TEXT NOT NULL,
    name_en TEXT NOT NULL,
    symbol TEXT DEFAULT '',
    buy_rate REAL DEFAULT 0,
    sell_rate REAL DEFAULT 0,
    is_base INTEGER DEFAULT 0,
    sort INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS counters (
    prefix TEXT PRIMARY KEY,
    last_no INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_no TEXT NOT NULL,
    date TEXT NOT NULL,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    currency TEXT NOT NULL,
    debit REAL DEFAULT 0,
    credit REAL DEFAULT 0,
    description TEXT DEFAULT '',
    ref_type TEXT NOT NULL,
    ref_id INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_ledger_customer ON ledger(customer_id, currency);
  CREATE INDEX IF NOT EXISTS idx_ledger_voucher ON ledger(voucher_no);
  CREATE INDEX IF NOT EXISTS idx_ledger_ref ON ledger(ref_type, ref_id);

  CREATE TABLE IF NOT EXISTS safe_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_no TEXT NOT NULL,
    date TEXT NOT NULL,
    safe_id INTEGER NOT NULL REFERENCES safes(id),
    currency TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT DEFAULT '',
    ref_type TEXT NOT NULL,
    ref_id INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_safe_mov ON safe_movements(safe_id, currency);
  CREATE INDEX IF NOT EXISTS idx_safe_mov_voucher ON safe_movements(voucher_no);
  CREATE INDEX IF NOT EXISTS idx_safe_mov_ref ON safe_movements(ref_type, ref_id);

  CREATE TABLE IF NOT EXISTS hawala (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_no TEXT NOT NULL,
    kind TEXT NOT NULL,
    date TEXT NOT NULL,
    sender_name TEXT DEFAULT '',
    sender_phone TEXT DEFAULT '',
    receiver_name TEXT DEFAULT '',
    receiver_phone TEXT DEFAULT '',
    from_city TEXT DEFAULT '',
    to_city TEXT DEFAULT '',
    customer_id INTEGER DEFAULT 0,
    currency TEXT NOT NULL,
    amount REAL NOT NULL,
    fee REAL DEFAULT 0,
    cash_amount REAL DEFAULT 0,
    safe_id INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    secret TEXT DEFAULT '',
    note TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    paid_at TEXT DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_hawala_kind ON hawala(kind, status);
  CREATE INDEX IF NOT EXISTS idx_hawala_voucher ON hawala(voucher_no);

  CREATE TABLE IF NOT EXISTS receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_no TEXT NOT NULL,
    kind TEXT NOT NULL,
    date TEXT NOT NULL,
    customer_id INTEGER NOT NULL,
    safe_id INTEGER NOT NULL,
    currency TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_receipts_voucher ON receipts(voucher_no);

  CREATE TABLE IF NOT EXISTS debit_credit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_no TEXT NOT NULL,
    kind TEXT NOT NULL,
    date TEXT NOT NULL,
    customer_id INTEGER NOT NULL,
    currency TEXT NOT NULL,
    amount REAL NOT NULL,
    reason TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_dc_voucher ON debit_credit(voucher_no);

  CREATE TABLE IF NOT EXISTS exchanges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_no TEXT NOT NULL,
    kind TEXT NOT NULL,
    date TEXT NOT NULL,
    customer_id INTEGER DEFAULT 0,
    foreign_currency TEXT NOT NULL,
    foreign_amount REAL NOT NULL,
    rate REAL NOT NULL,
    base_amount REAL NOT NULL,
    safe_foreign INTEGER NOT NULL,
    safe_base INTEGER NOT NULL,
    profit REAL DEFAULT 0,
    note TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_ex_voucher ON exchanges(voucher_no);

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_no TEXT NOT NULL,
    date TEXT NOT NULL,
    category TEXT DEFAULT '',
    safe_id INTEGER NOT NULL,
    currency TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_exp_voucher ON expenses(voucher_no);

  CREATE TABLE IF NOT EXISTS transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_no TEXT NOT NULL,
    date TEXT NOT NULL,
    from_safe INTEGER NOT NULL,
    to_safe INTEGER NOT NULL,
    currency TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_tr_voucher ON transfers(voucher_no);

  CREATE TABLE IF NOT EXISTS rate_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    currency TEXT NOT NULL,
    buy_rate REAL DEFAULT 0,
    sell_rate REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT DEFAULT ''
  );
  `);

  seed(db);
}

function seed(db: Database.Database) {
  const curCount = (db.prepare("SELECT COUNT(*) as c FROM currencies").get() as { c: number }).c;
  if (curCount === 0) {
    const insert = db.prepare(
      "INSERT INTO currencies (code, name_fa, name_en, symbol, buy_rate, sell_rate, is_base, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    const rows: [string, string, string, string, number, number, number, number][] = [
      ["AFN", "افغانی", "Afghani", "؋", 1, 1, 1, 1],
      ["USD", "دالر", "US Dollar", "$", 70.2, 70.7, 0, 2],
      ["EUR", "یورو", "Euro", "€", 76.1, 77.2, 0, 3],
      ["PKR", "کلدار پاکستانی", "Pakistani Rupee", "₨", 0.248, 0.256, 0, 4],
      ["IRR", "تومان ایران", "Iranian Toman", "ت", 0.0072, 0.0078, 0, 5],
      ["AED", "درهم امارات", "UAE Dirham", "د.إ", 19.1, 19.3, 0, 6],
      ["TRY", "لیره ترکیه", "Turkish Lira", "₺", 2.05, 2.15, 0, 7],
      ["GBP", "پوند", "British Pound", "£", 88.5, 89.8, 0, 8],
    ];
    const tx = db.transaction(() => {
      for (const r of rows) insert.run(...r);
    });
    tx();
  }

  const safeCount = (db.prepare("SELECT COUNT(*) as c FROM safes").get() as { c: number }).c;
  if (safeCount === 0) {
    db.prepare("INSERT INTO safes (name, type, account_no) VALUES (?, ?, ?)")
      .run("صندوق مرکزی", "cash", "");
    db.prepare("INSERT INTO safes (name, type, account_no) VALUES (?, ?, ?)")
      .run("بانک", "bank", "");
  }

  const settingsDefaults: Record<string, string> = {
    company_fa: "صرافی",
    company_en: "Sarafi Exchange",
    phone: "",
    address_fa: "کابل، افغانستان",
    address_en: "Kabul, Afghanistan",
    base_currency: "AFN",
    receipt_footer_fa: "از اعتماد شما سپاسگزاریم",
    receipt_footer_en: "Thank you for your trust",
  };
  const getSetting = db.prepare("SELECT value FROM settings WHERE key = ?");
  const setSetting = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
  for (const [k, v] of Object.entries(settingsDefaults)) {
    if (!getSetting.get(k)) setSetting.run(k, v);
  }
}

/** Generate next voucher number like HS-000001 (atomic). */
export function nextVoucher(db: Database.Database, prefix: string): string {
  const row = db.prepare("SELECT last_no FROM counters WHERE prefix = ?").get(prefix) as
    | { last_no: number }
    | undefined;
  const next = (row?.last_no ?? 0) + 1;
  db.prepare("INSERT INTO counters (prefix, last_no) VALUES (?, ?) ON CONFLICT(prefix) DO UPDATE SET last_no = ?").run(
    prefix,
    next,
    next
  );
  return `${prefix}-${String(next).padStart(6, "0")}`;
}

export interface LedgerInput {
  voucher_no: string;
  date: string;
  customer_id: number;
  currency: string;
  debit?: number;
  credit?: number;
  description?: string;
  ref_type: string;
  ref_id?: number;
}

export function addLedger(db: Database.Database, e: LedgerInput) {
  if (!e.customer_id) return;
  db.prepare(
    `INSERT INTO ledger (voucher_no, date, customer_id, currency, debit, credit, description, ref_type, ref_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    e.voucher_no,
    e.date,
    e.customer_id,
    e.currency,
    e.debit ?? 0,
    e.credit ?? 0,
    e.description ?? "",
    e.ref_type,
    e.ref_id ?? 0
  );
}

export interface SafeMoveInput {
  voucher_no: string;
  date: string;
  safe_id: number;
  currency: string;
  amount: number;
  description?: string;
  ref_type: string;
  ref_id?: number;
}

export function addSafeMove(db: Database.Database, m: SafeMoveInput) {
  if (!m.safe_id || !m.amount) return;
  db.prepare(
    `INSERT INTO safe_movements (voucher_no, date, safe_id, currency, amount, description, ref_type, ref_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    m.voucher_no,
    m.date,
    m.safe_id,
    m.currency,
    m.amount,
    m.description ?? "",
    m.ref_type,
    m.ref_id ?? 0
  );
}

/** Delete all ledger + safe rows linked to a ref (used when deleting a single row). */
export function deleteRefLinks(db: Database.Database, ref_type: string, ref_id: number) {
  db.prepare("DELETE FROM ledger WHERE ref_type = ? AND ref_id = ?").run(ref_type, ref_id);
  db.prepare("DELETE FROM safe_movements WHERE ref_type = ? AND ref_id = ?").run(ref_type, ref_id);
}

/** Delete all ledger + safe rows linked to a voucher (used when deleting a whole voucher). */
export function deleteVoucherLinks(db: Database.Database, voucher_no: string) {
  db.prepare("DELETE FROM ledger WHERE voucher_no = ?").run(voucher_no);
  db.prepare("DELETE FROM safe_movements WHERE voucher_no = ?").run(voucher_no);
}

export function getSetting(db: Database.Database, key: string): string {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? "";
}

export function getAllSettings(db: Database.Database): Record<string, string> {
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
