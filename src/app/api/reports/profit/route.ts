import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Profit and loss, normalized for summary only while preserving native-currency detail. */
export async function GET(req: NextRequest) {
  const db = getDb();
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from") || "0000-00-00";
  const to = sp.get("to") || "9999-99-99";

  const rates = db.prepare("SELECT * FROM currencies").all() as { code: string; buy_rate: number; sell_rate: number }[];
  const toAfn = (currency: string, amount: number) => {
    if (currency === "AFN") return amount;
    const rate = rates.find((item) => item.code === currency);
    const mid = rate ? (rate.buy_rate + rate.sell_rate) / 2 || rate.sell_rate || rate.buy_rate : 0;
    return amount * mid;
  };

  // `fee` is the v1-compatible commission value. The newer received_commission
  // takes precedence when it is populated. Commission currency may differ from
  // the hawala amount, so it is grouped independently.
  const commissions = db.prepare(`
    SELECT COALESCE(NULLIF(commission_currency, ''), currency) AS currency,
      SUM(CASE WHEN received_commission != 0 THEN received_commission ELSE fee END) AS received,
      SUM(paid_commission) AS paid
    FROM hawala
    WHERE status != 'cancelled' AND date BETWEEN ? AND ?
    GROUP BY COALESCE(NULLIF(commission_currency, ''), currency)
  `).all(from, to) as { currency: string; received: number; paid: number }[];
  const exchangeProfit = (db.prepare("SELECT SUM(profit) as t FROM exchanges WHERE date BETWEEN ? AND ?").get(from, to) as { t: number | null }).t ?? 0;
  const expenses = db.prepare("SELECT currency, SUM(amount) as t FROM expenses WHERE date BETWEEN ? AND ? GROUP BY currency").all(from, to) as { currency: string; t: number }[];

  const by_currency: Record<string, { fees: number; paid_commission: number; exchange: number; expenses: number }> = {};
  const set = (currency: string) => (by_currency[currency] ??= { fees: 0, paid_commission: 0, exchange: 0, expenses: 0 });
  let hawalaFees = 0;
  let paidCommissions = 0;
  for (const row of commissions) {
    const received = row.received ?? 0;
    const paid = row.paid ?? 0;
    hawalaFees += toAfn(row.currency, received);
    paidCommissions += toAfn(row.currency, paid);
    const item = set(row.currency);
    item.fees = received;
    item.paid_commission = paid;
  }
  let expenseTotal = 0;
  for (const row of expenses) {
    const amount = row.t ?? 0;
    expenseTotal += toAfn(row.currency, amount);
    set(row.currency).expenses = amount;
  }
  set("AFN").exchange = exchangeProfit;

  const round = (value: number) => Math.round(value * 100) / 100;
  return NextResponse.json({
    from, to,
    hawala_fees: round(hawalaFees),
    paid_commissions: round(paidCommissions),
    exchange_profit: round(exchangeProfit),
    expenses: round(expenseTotal),
    net: round(hawalaFees + exchangeProfit - paidCommissions - expenseTotal),
    by_currency,
  });
}
