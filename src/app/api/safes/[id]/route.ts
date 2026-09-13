import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const safe = db.prepare("SELECT * FROM safes WHERE id = ?").get(id);
  if (!safe) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from") || "0000-00-00";
  const to = sp.get("to") || "9999-99-99";
  const currency = sp.get("currency") || "";
  let sql = "SELECT * FROM safe_movements WHERE safe_id = ? AND date BETWEEN ? AND ?";
  const args: (string | number)[] = [id, from, to];
  if (currency) { sql += " AND currency = ?"; args.push(currency); }
  sql += " ORDER BY date, id";
  const movements = db.prepare(sql).all(...args);
  const bals = db.prepare("SELECT currency, SUM(amount) as balance FROM safe_movements WHERE safe_id = ? GROUP BY currency").all(id);
  return NextResponse.json({ safe, movements, balances: bals });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const b = await req.json();
  db.prepare("UPDATE safes SET name = ?, type = ?, account_no = ? WHERE id = ?").run(
    b.name?.trim() ?? "", b.type ?? "cash", b.account_no?.trim() ?? "", id);
  return NextResponse.json({ safe: db.prepare("SELECT * FROM safes WHERE id = ?").get(id) });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const used = db.prepare("SELECT COUNT(*) as c FROM safe_movements WHERE safe_id = ?").get(id) as { c: number };
  if (used.c > 0) return NextResponse.json({ error: "HAS_TRANSACTIONS" }, { status: 400 });
  db.prepare("DELETE FROM safes WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
