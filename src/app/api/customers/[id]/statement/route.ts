import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from") || "0000-00-00";
  const to = sp.get("to") || "9999-99-99";
  const currency = sp.get("currency") || "";

  const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(id);
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let entries;
  if (currency) {
    entries = db
      .prepare("SELECT * FROM ledger WHERE customer_id = ? AND currency = ? AND date BETWEEN ? AND ? ORDER BY date, id")
      .all(id, currency, from, to);
  } else {
    entries = db
      .prepare("SELECT * FROM ledger WHERE customer_id = ? AND date BETWEEN ? AND ? ORDER BY date, id")
      .all(id, from, to);
  }
  const totals: Record<string, { debit: number; credit: number; balance: number }> = {};
  for (const e of entries as { currency: string; debit: number; credit: number }[]) {
    if (!totals[e.currency]) totals[e.currency] = { debit: 0, credit: 0, balance: 0 };
    totals[e.currency].debit += e.debit ?? 0;
    totals[e.currency].credit += e.credit ?? 0;
    totals[e.currency].balance = totals[e.currency].credit - totals[e.currency].debit;
  }
  // Opening balance before `from`
  const opening: Record<string, number> = {};
  if (from !== "0000-00-00") {
    const rows = db
      .prepare(
        "SELECT currency, SUM(credit) - SUM(debit) as bal FROM ledger WHERE customer_id = ? AND date < ? GROUP BY currency"
      )
      .all(id, from) as { currency: string; bal: number }[];
    for (const r of rows) opening[r.currency] = r.bal ?? 0;
  }
  return NextResponse.json({ customer, entries, totals, opening });
}
