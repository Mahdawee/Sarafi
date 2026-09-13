import { NextRequest, NextResponse } from "next/server";
import { getDb, nextVoucher, addLedger, addSafeMove, todayISO } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  const sp = req.nextUrl.searchParams;
  const kind = sp.get("kind") || "";
  const q = sp.get("q")?.trim() || "";
  const from = sp.get("from") || "";
  const to = sp.get("to") || "";
  let sql = `SELECT r.*, c.name as customer_name, s.name as safe_name FROM receipts r
    LEFT JOIN customers c ON c.id = r.customer_id
    LEFT JOIN safes s ON s.id = r.safe_id WHERE 1=1`;
  const args: (string | number)[] = [];
  if (kind) { sql += " AND r.kind = ?"; args.push(kind); }
  if (from) { sql += " AND r.date >= ?"; args.push(from); }
  if (to) { sql += " AND r.date <= ?"; args.push(to); }
  if (q) { sql += " AND (r.voucher_no LIKE ? OR r.description LIKE ?)"; args.push(`%${q}%`, `%${q}%`); }
  sql += " ORDER BY r.date DESC, r.id DESC LIMIT 500";
  return NextResponse.json({ receipts: db.prepare(sql).all(...args) });
}

interface ReceiptRow {
  kind: "receive" | "pay";
  date?: string;
  customer_id: number;
  safe_id: number;
  currency: string;
  amount: number;
  description?: string;
}

/** Multi-entry: { rows: ReceiptRow[] } — one voucher for all rows. */
export async function POST(req: NextRequest) {
  const db = getDb();
  const b = (await req.json()) as { rows: ReceiptRow[] };
  if (!Array.isArray(b.rows) || b.rows.length === 0)
    return NextResponse.json({ error: "No rows" }, { status: 400 });
  for (const [i, r] of b.rows.entries()) {
    if (!r.customer_id || !r.safe_id || !r.currency || !r.amount || r.amount <= 0)
      return NextResponse.json({ error: `Row ${i + 1}: all fields are required` }, { status: 400 });
    if (r.kind !== "receive" && r.kind !== "pay")
      return NextResponse.json({ error: `Row ${i + 1}: invalid kind` }, { status: 400 });
  }
  let voucher_no = "";
  const today = todayISO();
  const ids: number[] = [];
  const insert = db.prepare(
    "INSERT INTO receipts (voucher_no, kind, date, customer_id, safe_id, currency, amount, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const tx = db.transaction(() => {
    voucher_no = nextVoucher(db, "RC");
    for (const r of b.rows) {
      const date = r.date || today;
      const info = insert.run(voucher_no, r.kind, date, r.customer_id, r.safe_id, r.currency, r.amount, r.description?.trim() ?? "");
      const id = Number(info.lastInsertRowid);
      ids.push(id);
      const desc = r.kind === "receive" ? `رسید دریافت ${voucher_no}` : `رسید پرداخت ${voucher_no}`;
      if (r.kind === "receive") {
        addLedger(db, { voucher_no, date, customer_id: r.customer_id, currency: r.currency, credit: r.amount, description: desc, ref_type: "receipt", ref_id: id });
        addSafeMove(db, { voucher_no, date, safe_id: r.safe_id, currency: r.currency, amount: r.amount, description: desc, ref_type: "receipt", ref_id: id });
      } else {
        addLedger(db, { voucher_no, date, customer_id: r.customer_id, currency: r.currency, debit: r.amount, description: desc, ref_type: "receipt", ref_id: id });
        addSafeMove(db, { voucher_no, date, safe_id: r.safe_id, currency: r.currency, amount: -r.amount, description: desc, ref_type: "receipt", ref_id: id });
      }
    }
  });
  tx();
  return NextResponse.json({ voucher_no, ids }, { status: 201 });
}
