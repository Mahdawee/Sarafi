import { NextRequest, NextResponse } from "next/server";
import { getDb, todayISO } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Multi-currency trial balance.  Values remain in their original currency;
 * this avoids silently combining USD, AFN and other currencies.
 */
export async function GET(req: NextRequest) {
  const db = getDb();
  const sp = req.nextUrl.searchParams;
  const to = sp.get("to") || todayISO();
  const q = sp.get("q")?.trim() || "";
  const currency = sp.get("currency") || "";

  const customerRows = db.prepare(`
    SELECT c.id, c.code, c.name, c.type AS customer_type, l.currency,
      COALESCE(SUM(l.debit), 0) AS debit,
      COALESCE(SUM(l.credit), 0) AS credit
    FROM customers c
    JOIN ledger l ON l.customer_id = c.id
    WHERE l.date <= ? ${currency ? "AND l.currency = ?" : ""}
    GROUP BY c.id, l.currency
  `).all(...(currency ? [to, currency] : [to])) as {
    id: number; code: string; name: string; customer_type: string; currency: string; debit: number; credit: number;
  }[];

  const safeRows = db.prepare(`
    SELECT s.id, s.name, s.type AS safe_type, m.currency,
      COALESCE(SUM(CASE WHEN m.amount > 0 THEN m.amount ELSE 0 END), 0) AS debit,
      COALESCE(SUM(CASE WHEN m.amount < 0 THEN -m.amount ELSE 0 END), 0) AS credit
    FROM safes s
    JOIN safe_movements m ON m.safe_id = s.id
    WHERE m.date <= ? ${currency ? "AND m.currency = ?" : ""}
    GROUP BY s.id, m.currency
  `).all(...(currency ? [to, currency] : [to])) as {
    id: number; name: string; safe_type: string; currency: string; debit: number; credit: number;
  }[];

  const rows = [
    ...customerRows.map((r) => ({
      account_type: "customer", account_id: r.id, code: r.code, name: r.name,
      detail_type: r.customer_type, currency: r.currency, debit: r.debit, credit: r.credit,
      // Credit minus debit maintains the customer-account convention used across this app.
      balance: r.credit - r.debit,
    })),
    ...safeRows.map((r) => ({
      account_type: "safe", account_id: r.id, code: "", name: r.name,
      detail_type: r.safe_type, currency: r.currency, debit: r.debit, credit: r.credit,
      // Asset/safe convention: in minus out.
      balance: r.debit - r.credit,
    })),
  ]
    .filter((r) => !q || r.name.includes(q) || r.code.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.currency.localeCompare(b.currency) || a.name.localeCompare(b.name, "fa"));

  const totals: Record<string, { debit: number; credit: number; net: number }> = {};
  for (const r of rows) {
    const t = (totals[r.currency] ??= { debit: 0, credit: 0, net: 0 });
    t.debit += r.debit;
    t.credit += r.credit;
    t.net += r.balance;
  }

  return NextResponse.json({ to, rows, totals });
}
