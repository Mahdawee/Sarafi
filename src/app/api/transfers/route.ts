import { NextRequest, NextResponse } from "next/server";
import { getDb, nextVoucher, addSafeMove, todayISO } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const rows = db.prepare(`SELECT t.*, fs.name as from_safe_name, ts.name as to_safe_name FROM transfers t
    LEFT JOIN safes fs ON fs.id = t.from_safe
    LEFT JOIN safes ts ON ts.id = t.to_safe
    ORDER BY t.date DESC, t.id DESC LIMIT 300`).all();
  return NextResponse.json({ transfers: rows });
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const b = (await req.json()) as {
    rows: { date?: string; from_safe: number; to_safe: number; currency: string; amount: number; description?: string }[];
  };
  if (!Array.isArray(b.rows) || b.rows.length === 0)
    return NextResponse.json({ error: "No rows" }, { status: 400 });
  for (const [i, r] of b.rows.entries()) {
    if (!r.from_safe || !r.to_safe || r.from_safe === r.to_safe || !r.currency || !r.amount || r.amount <= 0)
      return NextResponse.json({ error: `Row ${i + 1}: invalid transfer` }, { status: 400 });
  }
  const voucher_no = nextVoucher(db, "TR");
  const today = todayISO();
  const ids: number[] = [];
  const insert = db.prepare("INSERT INTO transfers (voucher_no, date, from_safe, to_safe, currency, amount, description) VALUES (?, ?, ?, ?, ?, ?, ?)");
  const tx = db.transaction(() => {
    for (const r of b.rows) {
      const date = r.date || today;
      const info = insert.run(voucher_no, date, r.from_safe, r.to_safe, r.currency, r.amount, r.description?.trim() ?? "");
      const id = Number(info.lastInsertRowid);
      ids.push(id);
      const desc = `انتقال ${voucher_no}`;
      addSafeMove(db, { voucher_no, date, safe_id: r.from_safe, currency: r.currency, amount: -r.amount, description: desc, ref_type: "transfer", ref_id: id });
      addSafeMove(db, { voucher_no, date, safe_id: r.to_safe, currency: r.currency, amount: r.amount, description: desc, ref_type: "transfer", ref_id: id });
    }
  });
  tx();
  return NextResponse.json({ voucher_no, ids }, { status: 201 });
}
