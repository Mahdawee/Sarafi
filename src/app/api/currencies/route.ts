import { NextRequest, NextResponse } from "next/server";
import { getDb, todayISO } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const currencies = db.prepare("SELECT * FROM currencies ORDER BY sort, code").all();
  return NextResponse.json({ currencies });
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const b = await req.json();
  const code = b.code?.trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "Code required" }, { status: 400 });
  try {
    db.prepare("INSERT INTO currencies (code, name_fa, name_en, symbol, buy_rate, sell_rate, sort) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(code, b.name_fa?.trim() || code, b.name_en?.trim() || code, b.symbol ?? "", b.buy_rate ?? 0, b.sell_rate ?? 0, b.sort ?? 99);
  } catch {
    return NextResponse.json({ error: "Duplicate code" }, { status: 400 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const db = getDb();
  const b = (await req.json()) as { rates: { code: string; buy_rate: number; sell_rate: number }[] };
  if (!Array.isArray(b.rates)) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const today = todayISO();
  const upd = db.prepare("UPDATE currencies SET buy_rate = ?, sell_rate = ? WHERE code = ?");
  const hist = db.prepare("INSERT INTO rate_history (date, currency, buy_rate, sell_rate) VALUES (?, ?, ?, ?)");
  const tx = db.transaction(() => {
    for (const r of b.rates) {
      upd.run(r.buy_rate ?? 0, r.sell_rate ?? 0, r.code);
      hist.run(today, r.code, r.buy_rate ?? 0, r.sell_rate ?? 0);
    }
  });
  tx();
  return NextResponse.json({ ok: true });
}
