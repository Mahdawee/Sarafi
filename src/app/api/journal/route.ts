import { NextRequest, NextResponse } from "next/server";
import { addAccountPosting, getDb, nextVoucher, todayISO, type AccountType } from "@/lib/db";

export const dynamic = "force-dynamic";

const accountJoins = `
  LEFT JOIN customers dc ON je.debit_account_type = 'customer' AND dc.id = je.debit_account_id
  LEFT JOIN safes ds ON je.debit_account_type = 'safe' AND ds.id = je.debit_account_id
  LEFT JOIN customers cc ON je.credit_account_type = 'customer' AND cc.id = je.credit_account_id
  LEFT JOIN safes cs ON je.credit_account_type = 'safe' AND cs.id = je.credit_account_id`;

/** General journal, with account names resolved for the list and print views. */
export async function GET(req: NextRequest) {
  const db = getDb();
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() || "";
  const from = sp.get("from") || "";
  const to = sp.get("to") || "";
  const currency = sp.get("currency") || "";
  const limit = Math.min(Math.max(Number(sp.get("limit") || 250), 1), 1000);

  let sql = `SELECT je.*,
    COALESCE(dc.name, ds.name, '') AS debit_account_name,
    COALESCE(cc.name, cs.name, '') AS credit_account_name
    FROM journal_entries je ${accountJoins} WHERE 1=1`;
  const args: (string | number)[] = [];
  if (from) { sql += " AND je.date >= ?"; args.push(from); }
  if (to) { sql += " AND je.date <= ?"; args.push(to); }
  if (currency) { sql += " AND je.currency = ?"; args.push(currency); }
  if (q) {
    sql += " AND (je.voucher_no LIKE ? OR je.description LIKE ? OR dc.name LIKE ? OR ds.name LIKE ? OR cc.name LIKE ? OR cs.name LIKE ?)";
    const like = `%${q}%`;
    args.push(like, like, like, like, like, like);
  }
  sql += " ORDER BY je.date DESC, je.id DESC LIMIT ?";
  args.push(limit);
  const entries = db.prepare(sql).all(...args);

  // Totals are intentionally returned by currency: currencies are never mixed
  // into a misleading single total.
  let sumSql = "SELECT currency, SUM(amount) AS amount, COUNT(*) AS count FROM journal_entries WHERE 1=1";
  const sumArgs: string[] = [];
  if (from) { sumSql += " AND date >= ?"; sumArgs.push(from); }
  if (to) { sumSql += " AND date <= ?"; sumArgs.push(to); }
  if (currency) { sumSql += " AND currency = ?"; sumArgs.push(currency); }
  sumSql += " GROUP BY currency ORDER BY currency";
  const totals = db.prepare(sumSql).all(...sumArgs);

  return NextResponse.json({ entries, totals });
}

type AccountRef = { type: AccountType; id: number };
interface JournalRow {
  date?: string;
  debit_account: AccountRef;
  credit_account: AccountRef;
  currency: string;
  amount: number;
  description?: string;
  is_commission?: boolean;
  is_suspicious?: boolean;
}

function validAccount(a: AccountRef | undefined): a is AccountRef {
  return !!a && (a.type === "customer" || a.type === "safe") && Number.isInteger(Number(a.id)) && Number(a.id) > 0;
}

/**
 * Adds several debit/credit rows under one journal voucher.  Each line is
 * balanced by construction: debit account == credit account amount.
 */
export async function POST(req: NextRequest) {
  const db = getDb();
  const body = (await req.json()) as { rows?: JournalRow[] };
  const rows = body.rows ?? [];
  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: "No journal rows" }, { status: 400 });

  const customerExists = db.prepare("SELECT 1 FROM customers WHERE id = ? AND is_active = 1");
  const safeExists = db.prepare("SELECT 1 FROM safes WHERE id = ? AND is_active = 1");
  const accountExists = (account: AccountRef) => Boolean((account.type === "customer" ? customerExists : safeExists).get(account.id));
  for (const [index, row] of rows.entries()) {
    if (!validAccount(row.debit_account) || !validAccount(row.credit_account) || !row.currency || !Number.isFinite(Number(row.amount)) || Number(row.amount) <= 0) {
      return NextResponse.json({ error: `Row ${index + 1}: debit account, credit account, currency and amount are required` }, { status: 400 });
    }
    if (!accountExists(row.debit_account) || !accountExists(row.credit_account)) {
      return NextResponse.json({ error: `Row ${index + 1}: selected account no longer exists` }, { status: 400 });
    }
    if (row.debit_account.type === row.credit_account.type && Number(row.debit_account.id) === Number(row.credit_account.id)) {
      return NextResponse.json({ error: `Row ${index + 1}: debit and credit accounts cannot be the same` }, { status: 400 });
    }
  }

  let voucher_no = "";
  const today = todayISO();
  const ids: number[] = [];
  const insert = db.prepare(`INSERT INTO journal_entries
    (voucher_no, date, debit_account_type, debit_account_id, credit_account_type, credit_account_id, currency, amount, description, is_commission, is_suspicious)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const tx = db.transaction(() => {
    voucher_no = nextVoucher(db, "JR");
    for (const row of rows) {
      const date = row.date || today;
      const amount = Number(row.amount);
      const description = row.description?.trim() || "";
      const info = insert.run(
        voucher_no, date,
        row.debit_account.type, row.debit_account.id,
        row.credit_account.type, row.credit_account.id,
        row.currency, amount, description,
        row.is_commission ? 1 : 0, row.is_suspicious ? 1 : 0
      );
      const id = Number(info.lastInsertRowid);
      ids.push(id);
      const details = `روزنامه ${voucher_no}${description ? ` — ${description}` : ""}`;
      addAccountPosting(db, {
        voucher_no, date, account_type: row.debit_account.type, account_id: row.debit_account.id,
        side: "debit", currency: row.currency, amount, description: details, ref_type: "journal", ref_id: id,
      });
      addAccountPosting(db, {
        voucher_no, date, account_type: row.credit_account.type, account_id: row.credit_account.id,
        side: "credit", currency: row.currency, amount, description: details, ref_type: "journal", ref_id: id,
      });
    }
  });
  tx();

  return NextResponse.json({ voucher_no, ids }, { status: 201 });
}
