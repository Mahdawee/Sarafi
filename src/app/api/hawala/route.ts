import { NextRequest, NextResponse } from "next/server";
import { getDb, nextVoucher, addLedger, addSafeMove, todayISO } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  const sp = req.nextUrl.searchParams;
  const kind = sp.get("kind") || "";
  const status = sp.get("status") || "";
  const q = sp.get("q")?.trim() || "";
  const from = sp.get("from") || "";
  const to = sp.get("to") || "";
  const limit = Math.min(Number(sp.get("limit") || 200), 1000);

  let sql = `SELECT h.*, c.name as customer_name, s.name as safe_name FROM hawala h
    LEFT JOIN customers c ON c.id = h.customer_id
    LEFT JOIN safes s ON s.id = h.safe_id WHERE 1=1`;
  const args: (string | number)[] = [];
  if (kind) { sql += " AND h.kind = ?"; args.push(kind); }
  if (status) { sql += " AND h.status = ?"; args.push(status); }
  if (from) { sql += " AND h.date >= ?"; args.push(from); }
  if (to) { sql += " AND h.date <= ?"; args.push(to); }
  if (q) {
    sql += " AND (h.sender_name LIKE ? OR h.receiver_name LIKE ? OR h.voucher_no LIKE ? OR h.secret LIKE ? OR h.sender_phone LIKE ? OR h.receiver_phone LIKE ?)";
    args.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  sql += " ORDER BY h.date DESC, h.id DESC LIMIT ?";
  args.push(limit);
  const rows = db.prepare(sql).all(...args);
  return NextResponse.json({ hawala: rows });
}

interface HawalaRow {
  date?: string;
  sender_name?: string; sender_phone?: string;
  receiver_name?: string; receiver_phone?: string;
  from_city?: string; to_city?: string;
  customer_id?: number;
  currency: string;
  amount: number;
  fee?: number;
  cash_amount?: number;
  safe_id?: number;
  secret?: string;
  note?: string;
  pay_now?: boolean;
}

/**
 * Multi-entry create: { kind: 'send'|'receive', rows: HawalaRow[] }
 * All rows share ONE voucher number and are saved with a single submit.
 */
export async function POST(req: NextRequest) {
  const db = getDb();
  const b = (await req.json()) as { kind: string; rows: HawalaRow[] };
  if (b.kind !== "send" && b.kind !== "receive")
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  if (!Array.isArray(b.rows) || b.rows.length === 0)
    return NextResponse.json({ error: "No rows" }, { status: 400 });

  for (const [i, r] of b.rows.entries()) {
    if (!r.currency || !r.amount || r.amount <= 0)
      return NextResponse.json({ error: `Row ${i + 1}: currency and amount are required` }, { status: 400 });
    if (!r.customer_id)
      return NextResponse.json({ error: `Row ${i + 1}: customer is required` }, { status: 400 });
  }

  const prefix = b.kind === "send" ? "HS" : "HR";
  const voucher_no = nextVoucher(db, prefix);
  const refType = b.kind === "send" ? "hawala_send" : "hawala_receive";
  const today = todayISO();
  const ids: number[] = [];

  const insert = db.prepare(`INSERT INTO hawala
    (voucher_no, kind, date, sender_name, sender_phone, receiver_name, receiver_phone,
     from_city, to_city, customer_id, currency, amount, fee, cash_amount, safe_id, status, secret, note, paid_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const tx = db.transaction(() => {
    for (const r of b.rows) {
      const date = r.date || today;
      const fee = r.fee ?? 0;
      const cash = r.cash_amount ?? 0;
      const paidNow = !!r.pay_now && (r.safe_id ?? 0) > 0;
      const status = paidNow ? "paid" : "pending";
      const info = insert.run(
        voucher_no, b.kind, date,
        r.sender_name?.trim() ?? "", r.sender_phone?.trim() ?? "",
        r.receiver_name?.trim() ?? "", r.receiver_phone?.trim() ?? "",
        r.from_city?.trim() ?? "", r.to_city?.trim() ?? "",
        r.customer_id ?? 0, r.currency, r.amount, fee, cash,
        r.safe_id ?? 0, status, r.secret?.trim() ?? "", r.note?.trim() ?? "",
        paidNow ? today : ""
      );
      const id = Number(info.lastInsertRowid);
      ids.push(id);

      if (b.kind === "send") {
        // Customer owes us: amount + fee
        addLedger(db, {
          voucher_no, date, customer_id: r.customer_id ?? 0, currency: r.currency,
          debit: r.amount + fee, description: `حواله ارسالی ${voucher_no} — ${r.receiver_name ?? ""}`,
          ref_type: refType, ref_id: id,
        });
        // Cash received from customer at creation
        if (cash > 0 && (r.safe_id ?? 0) > 0) {
          addLedger(db, {
            voucher_no, date, customer_id: r.customer_id ?? 0, currency: r.currency,
            credit: cash, description: `نقد دریافتی بابت حواله ${voucher_no}`,
            ref_type: refType, ref_id: id,
          });
          addSafeMove(db, {
            voucher_no, date, safe_id: r.safe_id ?? 0, currency: r.currency, amount: cash,
            description: `نقد حواله ارسالی ${voucher_no}`, ref_type: refType, ref_id: id,
          });
        }
      } else {
        // Agent credited: we owe the agent
        addLedger(db, {
          voucher_no, date, customer_id: r.customer_id ?? 0, currency: r.currency,
          credit: r.amount, description: `حواله دریافتی ${voucher_no} — ${r.sender_name ?? ""}`,
          ref_type: refType, ref_id: id,
        });
      }
      // Immediate payout from safe
      if (paidNow) {
        addSafeMove(db, {
          voucher_no, date: today, safe_id: r.safe_id ?? 0, currency: r.currency, amount: -r.amount,
          description: b.kind === "send" ? `پرداخت حواله ارسالی ${voucher_no}` : `پرداخت حواله دریافتی ${voucher_no}`,
          ref_type: "hawala_pay", ref_id: id,
        });
      }
    }
  });
  tx();

  return NextResponse.json({ voucher_no, ids }, { status: 201 });
}
