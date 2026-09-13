import { NextRequest, NextResponse } from "next/server";
import { getDb, nextVoucher, addLedger, todayISO } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  const sp = req.nextUrl.searchParams;
  const kind = sp.get("kind") || "";
  const q = sp.get("q")?.trim() || "";
  const from = sp.get("from") || "";
  const to = sp.get("to") || "";
  let sql = `SELECT d.*, c.name as customer_name FROM debit_credit d
    LEFT JOIN customers c ON c.id = d.customer_id WHERE 1=1`;
  const args: (string | number)[] = [];
  if (kind) { sql += " AND d.kind = ?"; args.push(kind); }
  if (from) { sql += " AND d.date >= ?"; args.push(from); }
  if (to) { sql += " AND d.date <= ?"; args.push(to); }
  if (q) { sql += " AND (d.voucher_no LIKE ? OR d.reason LIKE ?)"; args.push(`%${q}%`, `%${q}%`); }
  sql += " ORDER BY d.date DESC, d.id DESC LIMIT 500";
  return NextResponse.json({ items: db.prepare(sql).all(...args) });
}

interface DcRow {
  kind: "debit" | "credit";
  date?: string;
  customer_id: number;
  currency: string;
  amount: number;
  reason?: string;
}

/** Multi-entry: { rows: DcRow[] } — one voucher for all rows. */
export async function POST(req: NextRequest) {
  const db = getDb();
  const b = (await req.json()) as { rows: DcRow[] };
  if (!Array.isArray(b.rows) || b.rows.length === 0)
    return NextResponse.json({ error: "No rows" }, { status: 400 });
  for (const [i, r] of b.rows.entries()) {
    if (!r.customer_id || !r.currency || !r.amount || r.amount <= 0)
      return NextResponse.json({ error: `Row ${i + 1}: all fields are required` }, { status: 400 });
    if (r.kind !== "debit" && r.kind !== "credit")
      return NextResponse.json({ error: `Row ${i + 1}: invalid kind` }, { status: 400 });
  }
  let voucher_no = "";
  const today = todayISO();
  const ids: number[] = [];
  const insert = db.prepare(
    "INSERT INTO debit_credit (voucher_no, kind, date, customer_id, currency, amount, reason) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const tx = db.transaction(() => {
    voucher_no = nextVoucher(db, "DC");
    for (const r of b.rows) {
      const date = r.date || today;
      const info = insert.run(voucher_no, r.kind, date, r.customer_id, r.currency, r.amount, r.reason?.trim() ?? "");
      const id = Number(info.lastInsertRowid);
      ids.push(id);
      const desc = `${r.kind === "debit" ? "دبت" : "کردت"} ${voucher_no}${r.reason ? " — " + r.reason : ""}`;
      if (r.kind === "debit") {
        addLedger(db, { voucher_no, date, customer_id: r.customer_id, currency: r.currency, debit: r.amount, description: desc, ref_type: "debit_credit", ref_id: id });
      } else {
        addLedger(db, { voucher_no, date, customer_id: r.customer_id, currency: r.currency, credit: r.amount, description: desc, ref_type: "debit_credit", ref_id: id });
      }
    }
  });
  tx();
  return NextResponse.json({ voucher_no, ids }, { status: 201 });
}
