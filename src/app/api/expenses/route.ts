import { NextRequest, NextResponse } from "next/server";
import { getDb, nextVoucher, addSafeMove, todayISO } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from") || "";
  const to = sp.get("to") || "";
  const q = sp.get("q")?.trim() || "";
  let sql = `SELECT e.*, s.name as safe_name FROM expenses e LEFT JOIN safes s ON s.id = e.safe_id WHERE 1=1`;
  const args: (string | number)[] = [];
  if (from) { sql += " AND e.date >= ?"; args.push(from); }
  if (to) { sql += " AND e.date <= ?"; args.push(to); }
  if (q) { sql += " AND (e.description LIKE ? OR e.category LIKE ? OR e.voucher_no LIKE ?)"; args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  sql += " ORDER BY e.date DESC, e.id DESC LIMIT 500";
  return NextResponse.json({ expenses: db.prepare(sql).all(...args) });
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const b = (await req.json()) as {
    rows: { date?: string; category?: string; safe_id: number; currency: string; amount: number; description?: string }[];
  };
  if (!Array.isArray(b.rows) || b.rows.length === 0)
    return NextResponse.json({ error: "No rows" }, { status: 400 });
  for (const [i, r] of b.rows.entries()) {
    if (!r.safe_id || !r.currency || !r.amount || r.amount <= 0)
      return NextResponse.json({ error: `Row ${i + 1}: all fields are required` }, { status: 400 });
  }
  const voucher_no = nextVoucher(db, "EP");
  const today = todayISO();
  const ids: number[] = [];
  const insert = db.prepare("INSERT INTO expenses (voucher_no, date, category, safe_id, currency, amount, description) VALUES (?, ?, ?, ?, ?, ?, ?)");
  const tx = db.transaction(() => {
    for (const r of b.rows) {
      const date = r.date || today;
      const info = insert.run(voucher_no, date, r.category?.trim() ?? "", r.safe_id, r.currency, r.amount, r.description?.trim() ?? "");
      const id = Number(info.lastInsertRowid);
      ids.push(id);
      addSafeMove(db, { voucher_no, date, safe_id: r.safe_id, currency: r.currency, amount: -r.amount, description: `مصرف ${voucher_no} — ${r.description ?? ""}`, ref_type: "expense", ref_id: id });
    }
  });
  tx();
  return NextResponse.json({ voucher_no, ids }, { status: 201 });
}
