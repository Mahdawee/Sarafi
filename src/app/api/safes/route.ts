import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const safes = db.prepare("SELECT * FROM safes WHERE is_active = 1 ORDER BY id").all();
  const sums = db.prepare(
    "SELECT safe_id, currency, SUM(amount) as balance FROM safe_movements GROUP BY safe_id, currency"
  ).all() as { safe_id: number; currency: string; balance: number }[];
  const balances: Record<number, Record<string, number>> = {};
  for (const s of sums) {
    if (!balances[s.safe_id]) balances[s.safe_id] = {};
    balances[s.safe_id][s.currency] = s.balance ?? 0;
  }
  return NextResponse.json({ safes, balances });
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const b = await req.json();
  if (!b.name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const info = db.prepare("INSERT INTO safes (name, type, account_no) VALUES (?, ?, ?)")
    .run(b.name.trim(), b.type ?? "cash", b.account_no?.trim() ?? "");
  const safe = db.prepare("SELECT * FROM safes WHERE id = ?").get(info.lastInsertRowid);
  return NextResponse.json({ safe }, { status: 201 });
}
