import { NextRequest, NextResponse } from "next/server";
import { getDb, nextVoucher, addLedger, addSafeMove, todayISO } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  const sp = req.nextUrl.searchParams;
  const kind = sp.get("kind") || "";
  const from = sp.get("from") || "";
  const to = sp.get("to") || "";
  let sql = `SELECT e.*, c.name as customer_name, sf.name as safe_foreign_name, sb.name as safe_base_name FROM exchanges e
    LEFT JOIN customers c ON c.id = e.customer_id
    LEFT JOIN safes sf ON sf.id = e.safe_foreign
    LEFT JOIN safes sb ON sb.id = e.safe_base WHERE 1=1`;
  const args: (string | number)[] = [];
  if (kind) { sql += " AND e.kind = ?"; args.push(kind); }
  if (from) { sql += " AND e.date >= ?"; args.push(from); }
  if (to) { sql += " AND e.date <= ?"; args.push(to); }
  sql += " ORDER BY e.date DESC, e.id DESC LIMIT 500";
  return NextResponse.json({ exchanges: db.prepare(sql).all(...args) });
}

interface ExRow {
  kind: "buy" | "sell";
  date?: string;
  customer_id?: number;
  foreign_currency: string;
  foreign_amount: number;
  rate: number;
  safe_foreign: number;
  safe_base: number;
  note?: string;
}

/** Multi-entry: { rows: ExRow[] } */
export async function POST(req: NextRequest) {
  const db = getDb();
  const b = (await req.json()) as { rows: ExRow[] };
  if (!Array.isArray(b.rows) || b.rows.length === 0)
    return NextResponse.json({ error: "No rows" }, { status: 400 });
  for (const [i, r] of b.rows.entries()) {
    if (!r.foreign_currency || !r.foreign_amount || r.foreign_amount <= 0 || !r.rate || r.rate <= 0)
      return NextResponse.json({ error: `Row ${i + 1}: currency, amount and rate are required` }, { status: 400 });
    if (!r.safe_foreign || !r.safe_base)
      return NextResponse.json({ error: `Row ${i + 1}: both safes are required` }, { status: 400 });
  }
  const voucher_no = nextVoucher(db, "EX");
  const today = todayISO();
  const ids: number[] = [];
  const getRate = db.prepare("SELECT buy_rate, sell_rate FROM currencies WHERE code = ?");
  const insert = db.prepare(`INSERT INTO exchanges
    (voucher_no, kind, date, customer_id, foreign_currency, foreign_amount, rate, base_amount, safe_foreign, safe_base, profit, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const tx = db.transaction(() => {
    for (const r of b.rows) {
      const date = r.date || today;
      const base_amount = Math.round(r.foreign_amount * r.rate * 100) / 100;
      let profit = 0;
      if (r.kind === "sell") {
        const cur = getRate.get(r.foreign_currency) as { buy_rate: number; sell_rate: number } | undefined;
        const cost = cur?.buy_rate ?? r.rate;
        profit = Math.round((r.rate - cost) * r.foreign_amount * 100) / 100;
      }
      const info = insert.run(voucher_no, r.kind, date, r.customer_id ?? 0, r.foreign_currency,
        r.foreign_amount, r.rate, base_amount, r.safe_foreign, r.safe_base, profit, r.note?.trim() ?? "");
      const id = Number(info.lastInsertRowid);
      ids.push(id);
      const desc = `${r.kind === "buy" ? "خرید" : "فروش"} ${r.foreign_currency} ${voucher_no}`;
      if (r.kind === "buy") {
        addSafeMove(db, { voucher_no, date, safe_id: r.safe_foreign, currency: r.foreign_currency, amount: r.foreign_amount, description: desc, ref_type: "exchange", ref_id: id });
        if (r.customer_id) {
          addLedger(db, { voucher_no, date, customer_id: r.customer_id, currency: "AFN", credit: base_amount, description: desc, ref_type: "exchange", ref_id: id });
        } else {
          addSafeMove(db, { voucher_no, date, safe_id: r.safe_base, currency: "AFN", amount: -base_amount, description: desc, ref_type: "exchange", ref_id: id });
        }
      } else {
        addSafeMove(db, { voucher_no, date, safe_id: r.safe_foreign, currency: r.foreign_currency, amount: -r.foreign_amount, description: desc, ref_type: "exchange", ref_id: id });
        if (r.customer_id) {
          addLedger(db, { voucher_no, date, customer_id: r.customer_id, currency: "AFN", debit: base_amount, description: desc, ref_type: "exchange", ref_id: id });
        } else {
          addSafeMove(db, { voucher_no, date, safe_id: r.safe_base, currency: "AFN", amount: base_amount, description: desc, ref_type: "exchange", ref_id: id });
        }
      }
    }
  });
  tx();
  return NextResponse.json({ voucher_no, ids }, { status: 201 });
}
