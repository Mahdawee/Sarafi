import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from") || "0000-00-00";
  const to = sp.get("to") || "9999-99-99";

  const rates = db.prepare("SELECT * FROM currencies").all() as { code: string; buy_rate: number; sell_rate: number }[];
  const toAfn = (cur: string, amt: number) => {
    if (cur === "AFN") return amt;
    const r = rates.find((x) => x.code === cur);
    const mid = r ? (r.buy_rate + r.sell_rate) / 2 || r.sell_rate || r.buy_rate : 0;
    return amt * mid;
  };

  const fees = db.prepare("SELECT currency, SUM(fee) as t FROM hawala WHERE status != 'cancelled' AND date BETWEEN ? AND ? GROUP BY currency").all(from, to) as { currency: string; t: number }[];
  const exProfit = (db.prepare("SELECT SUM(profit) as t FROM exchanges WHERE date BETWEEN ? AND ?").get(from, to) as { t: number }).t ?? 0;
  const expenses = db.prepare("SELECT currency, SUM(amount) as t FROM expenses WHERE date BETWEEN ? AND ? GROUP BY currency").all(from, to) as { currency: string; t: number }[];

  const by_currency: Record<string, { fees: number; exchange: number; expenses: number }> = {};
  let hawala_fees = 0;
  for (const f of fees) {
    hawala_fees += toAfn(f.currency, f.t ?? 0);
    if (!by_currency[f.currency]) by_currency[f.currency] = { fees: 0, exchange: 0, expenses: 0 };
    by_currency[f.currency].fees = f.t ?? 0;
  }
  let expTotal = 0;
  for (const e of expenses) {
    expTotal += toAfn(e.currency, e.t ?? 0);
    if (!by_currency[e.currency]) by_currency[e.currency] = { fees: 0, exchange: 0, expenses: 0 };
    by_currency[e.currency].expenses = e.t ?? 0;
  }
  if (!by_currency["AFN"]) by_currency["AFN"] = { fees: 0, exchange: 0, expenses: 0 };
  by_currency["AFN"].exchange = exProfit;

  return NextResponse.json({
    from, to,
    hawala_fees: Math.round(hawala_fees * 100) / 100,
    exchange_profit: Math.round(exProfit * 100) / 100,
    expenses: Math.round(expTotal * 100) / 100,
    net: Math.round((hawala_fees + exProfit - expTotal) * 100) / 100,
    by_currency,
  });
}
