import { NextRequest, NextResponse } from "next/server";
import { getDb, nextVoucher } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  let customers;
  if (q) {
    customers = db
      .prepare("SELECT * FROM customers WHERE is_active = 1 AND (name LIKE ? OR phone LIKE ? OR code LIKE ?) ORDER BY name")
      .all(`%${q}%`, `%${q}%`, `%${q}%`);
  } else {
    customers = db.prepare("SELECT * FROM customers WHERE is_active = 1 ORDER BY name").all();
  }
  const sums = db
    .prepare(
      "SELECT customer_id, currency, SUM(debit) as debit, SUM(credit) as credit FROM ledger GROUP BY customer_id, currency"
    )
    .all() as { customer_id: number; currency: string; debit: number; credit: number }[];
  const byCustomer: Record<number, Record<string, { debit: number; credit: number; balance: number }>> = {};
  for (const s of sums) {
    if (!byCustomer[s.customer_id]) byCustomer[s.customer_id] = {};
    byCustomer[s.customer_id][s.currency] = {
      debit: s.debit ?? 0,
      credit: s.credit ?? 0,
      balance: (s.credit ?? 0) - (s.debit ?? 0),
    };
  }
  return NextResponse.json({ customers, balances: byCustomer });
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const b = await req.json();
  if (!b.name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const code = b.code?.trim() || nextVoucher(db, "C");
  try {
    const info = db
      .prepare("INSERT INTO customers (code, name, phone, address, father_name, national_id, email, type, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(
        code, b.name.trim(), b.phone?.trim() ?? "", b.address?.trim() ?? "",
        b.father_name?.trim() ?? "", b.national_id?.trim() ?? "", b.email?.trim() ?? "",
        b.type ?? "customer", b.note?.trim() ?? ""
      );
    const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(info.lastInsertRowid);
    return NextResponse.json({ customer }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not create customer (duplicate code?)" }, { status: 400 });
  }
}
