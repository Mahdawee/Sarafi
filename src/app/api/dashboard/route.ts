import { NextResponse } from "next/server";
import { getDb, todayISO } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const today = todayISO();

  const safes = db.prepare("SELECT * FROM safes WHERE is_active = 1 ORDER BY id").all() as {
    id: number; name: string; type: string }[];
  const sums = db.prepare(
    "SELECT safe_id, currency, SUM(amount) as balance FROM safe_movements GROUP BY safe_id, currency"
  ).all() as { safe_id: number; currency: string; balance: number }[];
  const balances: Record<number, Record<string, number>> = {};
  for (const s of sums) {
    if (!balances[s.safe_id]) balances[s.safe_id] = {};
    balances[s.safe_id][s.currency] = s.balance ?? 0;
  }

  const rates = db.prepare("SELECT * FROM currencies ORDER BY sort, code").all() as {
    code: string; buy_rate: number; sell_rate: number; is_base: number }[];
  const toAfn = (cur: string, amt: number) => {
    if (cur === "AFN") return amt;
    const r = rates.find((x) => x.code === cur);
    if (!r) return 0;
    const mid = (r.buy_rate + r.sell_rate) / 2 || r.sell_rate || r.buy_rate;
    return amt * mid;
  };

  const scalar = (sql: string, ...args: (string | number)[]) =>
    (db.prepare(sql).get(...args) as { v: number } | undefined)?.v ?? 0;

  const sendRows = db.prepare("SELECT currency, amount FROM hawala WHERE kind = 'send' AND status != 'cancelled' AND date = ?").all(today) as { currency: string; amount: number }[];
  const recvRows = db.prepare("SELECT currency, amount FROM hawala WHERE kind = 'receive' AND status != 'cancelled' AND date = ?").all(today) as { currency: string; amount: number }[];
  const feeRows = db.prepare("SELECT currency, fee FROM hawala WHERE status != 'cancelled' AND date = ?").all(today) as { currency: string; fee: number }[];
  const inRows = db.prepare("SELECT currency, amount FROM receipts WHERE kind = 'receive' AND date = ?").all(today) as { currency: string; amount: number }[];
  const outRows = db.prepare("SELECT currency, amount FROM receipts WHERE kind = 'pay' AND date = ?").all(today) as { currency: string; amount: number }[];
  const expRows = db.prepare("SELECT currency, amount FROM expenses WHERE date = ?").all(today) as { currency: string; amount: number }[];
  const sum = (rows: { currency: string; amount: number }[]) => rows.reduce((t, r) => t + toAfn(r.currency, r.amount), 0);

  const pendingSend = db.prepare(`SELECT h.*, c.name as customer_name FROM hawala h LEFT JOIN customers c ON c.id = h.customer_id WHERE h.kind = 'send' AND h.status = 'pending' ORDER BY h.date, h.id LIMIT 20`).all();
  const pendingRecv = db.prepare(`SELECT h.*, c.name as customer_name FROM hawala h LEFT JOIN customers c ON c.id = h.customer_id WHERE h.kind = 'receive' AND h.status = 'pending' ORDER BY h.date, h.id LIMIT 20`).all();

  const recent: { voucher_no: string; date: string; type: string; label: string; amount: number; currency: string }[] = [];
  const pushRecent = (rows: Record<string, unknown>[], type: string, labelKey: string) => {
    for (const r of rows) {
      recent.push({
        voucher_no: String(r.voucher_no), date: String(r.date), type,
        label: String(r[labelKey] ?? ""), amount: Number(r.amount ?? r.foreign_amount ?? 0),
        currency: String(r.currency ?? r.foreign_currency ?? ""),
      });
    }
  };
  pushRecent(db.prepare("SELECT voucher_no, date, receiver_name, amount, currency FROM hawala WHERE kind='send' ORDER BY id DESC LIMIT 5").all() as Record<string, unknown>[], "send", "receiver_name");
  pushRecent(db.prepare("SELECT voucher_no, date, sender_name, amount, currency FROM hawala WHERE kind='receive' ORDER BY id DESC LIMIT 5").all() as Record<string, unknown>[], "receive", "sender_name");
  pushRecent(db.prepare("SELECT voucher_no, date, description, amount, currency FROM receipts ORDER BY id DESC LIMIT 5").all() as Record<string, unknown>[], "receipt", "description");
  pushRecent(db.prepare("SELECT voucher_no, date, note, foreign_amount, foreign_currency FROM exchanges ORDER BY id DESC LIMIT 5").all() as Record<string, unknown>[], "exchange", "note");
  recent.sort((a, b) => (a.date < b.date ? 1 : -1));
  const recentTop = recent.slice(0, 10);

  const custSums = db.prepare("SELECT currency, SUM(debit) as debit, SUM(credit) as credit FROM ledger GROUP BY currency").all() as { currency: string; debit: number; credit: number }[];
  const customerTotals: Record<string, { debit: number; credit: number }> = {};
  for (const c of custSums) customerTotals[c.currency] = { debit: c.debit ?? 0, credit: c.credit ?? 0 };

  return NextResponse.json({
    safes: safes.map((s) => ({ ...s, balances: balances[s.id] ?? {} })),
    rates,
    today: {
      date: today,
      send_count: sendRows.length,
      send_total_afn: Math.round(sum(sendRows)),
      receive_count: recvRows.length,
      receive_total_afn: Math.round(sum(recvRows)),
      receipts_in_afn: Math.round(sum(inRows)),
      receipts_out_afn: Math.round(sum(outRows)),
      expenses_afn: Math.round(sum(expRows)),
      fees_afn: Math.round(feeRows.reduce((t, r) => t + toAfn(r.currency, r.fee ?? 0), 0)),
      _check: scalar("SELECT COUNT(*) as v FROM hawala"),
    },
    pending: { send: pendingSend, receive: pendingRecv },
    recent: recentTop,
    customerTotals,
  });
}
