import { NextRequest, NextResponse } from "next/server";
import { getDb, nextVoucher, addAccountPosting, addLedger, addSafeMove, todayISO, type AccountType } from "@/lib/db";

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

  let sql = `SELECT h.*, c.name as customer_name, s.name as safe_name,
    COALESCE(fc.name, fs.name, '') as from_account_name,
    COALESCE(tc.name, ts.name, '') as to_account_name
    FROM hawala h
    LEFT JOIN customers c ON c.id = h.customer_id
    LEFT JOIN safes s ON s.id = h.safe_id
    LEFT JOIN customers fc ON h.from_account_type = 'customer' AND fc.id = h.from_account_id
    LEFT JOIN safes fs ON h.from_account_type = 'safe' AND fs.id = h.from_account_id
    LEFT JOIN customers tc ON h.to_account_type = 'customer' AND tc.id = h.to_account_id
    LEFT JOIN safes ts ON h.to_account_type = 'safe' AND ts.id = h.to_account_id
    WHERE 1=1`;
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
  return NextResponse.json({ hawala: db.prepare(sql).all(...args) });
}

type AccountRef = { type?: AccountType | ""; id?: number };
interface HawalaRow {
  date?: string;
  sender_name?: string; sender_phone?: string;
  receiver_name?: string; receiver_phone?: string;
  from_city?: string; to_city?: string;
  customer_id?: number;
  // `currency` / `amount` remain supported for existing integrations.
  currency?: string;
  amount?: number;
  fee?: number;
  cash_amount?: number;
  safe_id?: number;
  secret?: string;
  note?: string;
  pay_now?: boolean;
  // Reference-screen compatible two-sided hawala fields.
  sent_currency?: string;
  sent_amount?: number;
  received_currency?: string;
  received_amount?: number;
  exchange_rate?: number;
  from_account?: AccountRef;
  to_account?: AccountRef;
  received_commission?: number;
  paid_commission?: number;
  commission_currency?: string;
  payment_method?: "cash" | "account";
  verification_status?: "confirmed" | "pending";
}

function isAccount(ref: AccountRef | undefined): ref is { type: AccountType; id: number } {
  return !!ref && (ref.type === "customer" || ref.type === "safe") && Number(ref.id) > 0;
}

/**
 * Multi-entry create: all staged lines share one HS/HR voucher.  Alongside the
 * original simple amount this accepts the two-sided send/receive/rate/account
 * fields shown in the supplied SarafMaster screens.
 */
export async function POST(req: NextRequest) {
  const db = getDb();
  const body = (await req.json()) as { kind: string; rows: HawalaRow[] };
  if (body.kind !== "send" && body.kind !== "receive")
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  if (!Array.isArray(body.rows) || body.rows.length === 0)
    return NextResponse.json({ error: "No rows" }, { status: 400 });

  const customerExists = db.prepare("SELECT 1 FROM customers WHERE id = ? AND is_active = 1");
  const safeExists = db.prepare("SELECT 1 FROM safes WHERE id = ? AND is_active = 1");
  const accountExists = (account: { type: AccountType; id: number }) => Boolean((account.type === "customer" ? customerExists : safeExists).get(account.id));
  for (const [i, row] of body.rows.entries()) {
    const currency = row.sent_currency?.trim() || row.currency?.trim() || "";
    const amount = Number(row.sent_amount || row.amount || 0);
    if (!currency || !Number.isFinite(amount) || amount <= 0)
      return NextResponse.json({ error: `Row ${i + 1}: sent currency and amount are required` }, { status: 400 });
    const fromRef = row.from_account;
    const toRef = row.to_account;
    const hasFromAccount = isAccount(fromRef);
    const hasToAccount = isAccount(toRef);
    if (!row.customer_id && !hasFromAccount && !hasToAccount)
      return NextResponse.json({ error: `Row ${i + 1}: an account is required` }, { status: 400 });
    if (hasFromAccount !== hasToAccount)
      return NextResponse.json({ error: `Row ${i + 1}: select both source and destination accounts` }, { status: 400 });
    if (hasFromAccount && hasToAccount && fromRef.type === toRef.type && fromRef.id === toRef.id)
      return NextResponse.json({ error: `Row ${i + 1}: source and destination must differ` }, { status: 400 });
    if (row.customer_id && !customerExists.get(row.customer_id))
      return NextResponse.json({ error: `Row ${i + 1}: customer no longer exists` }, { status: 400 });
    if ((isAccount(row.from_account) && !accountExists(row.from_account)) || (isAccount(row.to_account) && !accountExists(row.to_account)))
      return NextResponse.json({ error: `Row ${i + 1}: selected account no longer exists` }, { status: 400 });
    if (row.safe_id && !safeExists.get(row.safe_id))
      return NextResponse.json({ error: `Row ${i + 1}: safe no longer exists` }, { status: 400 });
  }

  const prefix = body.kind === "send" ? "HS" : "HR";
  let voucher_no = "";
  const refType = body.kind === "send" ? "hawala_send" : "hawala_receive";
  const today = todayISO();
  const ids: number[] = [];
  const insert = db.prepare(`INSERT INTO hawala
    (voucher_no, kind, date, sender_name, sender_phone, receiver_name, receiver_phone,
     from_city, to_city, customer_id, currency, amount, fee, cash_amount, safe_id, status, secret, note, paid_at,
     sent_currency, sent_amount, received_currency, received_amount, exchange_rate,
     from_account_type, from_account_id, to_account_type, to_account_id,
     received_commission, paid_commission, commission_currency, payment_method, verification_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const tx = db.transaction(() => {
    voucher_no = nextVoucher(db, prefix);
    for (const row of body.rows) {
      const date = row.date || today;
      const currency = row.sent_currency?.trim() || row.currency?.trim() || "";
      const amount = Number(row.sent_amount || row.amount || 0);
      const receivedCurrency = row.received_currency?.trim() || currency;
      const receivedAmount = Number(row.received_amount || amount || 0);
      const fee = Number(row.received_commission ?? row.fee ?? 0) || 0;
      const paidCommission = Number(row.paid_commission ?? 0) || 0;
      const commissionCurrency = row.commission_currency?.trim() || currency;
      const cash = Number(row.cash_amount ?? 0) || 0;
      const paidNow = !!row.pay_now && Number(row.safe_id) > 0;
      const status = paidNow ? "paid" : "pending";
      const fromAccount = isAccount(row.from_account) ? row.from_account : null;
      const toAccount = isAccount(row.to_account) ? row.to_account : null;
      // Keep one legacy customer link for existing lists/statements. For a
      // two-sided row, prefer the customer selected as the from account.
      const customerId = Number(row.customer_id) ||
        (fromAccount?.type === "customer" ? fromAccount.id : 0) ||
        (toAccount?.type === "customer" ? toAccount.id : 0);
      const info = insert.run(
        voucher_no, body.kind, date,
        row.sender_name?.trim() ?? "", row.sender_phone?.trim() ?? "",
        row.receiver_name?.trim() ?? "", row.receiver_phone?.trim() ?? "",
        row.from_city?.trim() ?? "", row.to_city?.trim() ?? "",
        customerId, currency, amount, fee, cash, row.safe_id ?? 0, status,
        row.secret?.trim() ?? "", row.note?.trim() ?? "", paidNow ? today : "",
        currency, amount, receivedCurrency, receivedAmount, Number(row.exchange_rate ?? 0) || 0,
        fromAccount?.type ?? "", fromAccount?.id ?? 0, toAccount?.type ?? "", toAccount?.id ?? 0,
        fee, paidCommission, commissionCurrency, row.payment_method === "account" ? "account" : "cash",
        row.verification_status === "pending" ? "pending" : "confirmed"
      );
      const id = Number(info.lastInsertRowid);
      ids.push(id);

      const hasExplicitAccounts = !!fromAccount && !!toAccount;
      const directionLabel = body.kind === "send" ? "حواله ارسالی" : "حواله دریافتی";
      const counterpartyName = body.kind === "send" ? row.receiver_name : row.sender_name;

      if (hasExplicitAccounts) {
        // An account-to-account hawala must affect both selected accounts.
        // These sides also work for a safe/bank account through addAccountPosting.
        if (body.kind === "send") {
          addAccountPosting(db, {
            voucher_no, date, account_type: fromAccount.type, account_id: fromAccount.id,
            side: "debit", currency, amount: amount + fee,
            description: `${directionLabel} ${voucher_no} — ${counterpartyName ?? ""}`,
            ref_type: refType, ref_id: id,
          });
          addAccountPosting(db, {
            voucher_no, date, account_type: toAccount.type, account_id: toAccount.id,
            side: "credit", currency: receivedCurrency, amount: receivedAmount,
            description: `${directionLabel} ${voucher_no} — ${row.sender_name ?? ""}`,
            ref_type: refType, ref_id: id,
          });
        } else {
          addAccountPosting(db, {
            voucher_no, date, account_type: fromAccount.type, account_id: fromAccount.id,
            side: "credit", currency, amount,
            description: `${directionLabel} ${voucher_no} — ${counterpartyName ?? ""}`,
            ref_type: refType, ref_id: id,
          });
          addAccountPosting(db, {
            voucher_no, date, account_type: toAccount.type, account_id: toAccount.id,
            side: "debit", currency: receivedCurrency, amount: receivedAmount + fee,
            description: `${directionLabel} ${voucher_no} — ${row.receiver_name ?? ""}`,
            ref_type: refType, ref_id: id,
          });
        }
      } else if (body.kind === "send") {
        // Preserve the original simple send-hawala behavior for API callers
        // which only supply the legacy customer_id field.
        addLedger(db, {
          voucher_no, date, customer_id: customerId, currency,
          debit: amount + fee,
          description: `حواله ارسالی ${voucher_no} — ${row.receiver_name ?? ""}`,
          ref_type: refType, ref_id: id,
        });
      } else {
        addLedger(db, {
          voucher_no, date, customer_id: customerId, currency, credit: amount,
          description: `حواله دریافتی ${voucher_no} — ${row.sender_name ?? ""}`,
          ref_type: refType, ref_id: id,
        });
      }

      // Cash collection settles the selected sender/counterparty account and
      // increases the cash safe. Avoid double-counting when that source itself
      // is the same safe selected for the cash movement.
      if (cash > 0 && Number(row.safe_id) > 0) {
        const sourceIsCashSafe = fromAccount?.type === "safe" && fromAccount.id === Number(row.safe_id);
        if (hasExplicitAccounts && fromAccount?.type === "customer") {
          addAccountPosting(db, {
            voucher_no, date, account_type: "customer", account_id: fromAccount.id,
            side: body.kind === "send" ? "credit" : "debit", currency, amount: cash,
            description: `نقد ${directionLabel} ${voucher_no}`,
            ref_type: refType, ref_id: id,
          });
        } else if (!hasExplicitAccounts && body.kind === "send") {
          addLedger(db, {
            voucher_no, date, customer_id: customerId, currency, credit: cash,
            description: `نقد دریافتی بابت حواله ${voucher_no}`,
            ref_type: refType, ref_id: id,
          });
        }
        if (!sourceIsCashSafe) {
          addSafeMove(db, {
            voucher_no, date, safe_id: Number(row.safe_id), currency, amount: cash,
            description: `نقد ${directionLabel} ${voucher_no}`, ref_type: refType, ref_id: id,
          });
        }
      }

      // If the payout is confirmed immediately, cash leaves the selected safe
      // in the recipient currency/amount (not necessarily the sending currency).
      const destinationIsPayoutSafe = toAccount?.type === "safe" && toAccount.id === Number(row.safe_id);
      if (paidNow && !destinationIsPayoutSafe) {
        addSafeMove(db, {
          voucher_no, date: today, safe_id: Number(row.safe_id), currency: receivedCurrency, amount: -receivedAmount,
          description: body.kind === "send" ? `پرداخت حواله ارسالی ${voucher_no}` : `پرداخت حواله دریافتی ${voucher_no}`,
          ref_type: "hawala_pay", ref_id: id,
        });
      }
      // A commission paid to a correspondent is a real cash outflow. Reuse
      // the hawala ref type so row/voucher deletion reverses it safely.
      if (paidCommission > 0 && Number(row.safe_id) > 0) {
        addSafeMove(db, {
          voucher_no, date, safe_id: Number(row.safe_id), currency: commissionCurrency, amount: -paidCommission,
          description: `کمیشن پرداختی حواله ${voucher_no}`,
          ref_type: refType, ref_id: id,
        });
      }
    }
  });
  tx();

  return NextResponse.json({ voucher_no, ids }, { status: 201 });
}
