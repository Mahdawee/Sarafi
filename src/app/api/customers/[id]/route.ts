import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(id);
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ customer });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const b = await req.json();
  db.prepare("UPDATE customers SET name = ?, phone = ?, address = ?, father_name = ?, national_id = ?, email = ?, type = ?, note = ? WHERE id = ?").run(
    b.name?.trim() ?? "",
    b.phone?.trim() ?? "",
    b.address?.trim() ?? "",
    b.father_name?.trim() ?? "",
    b.national_id?.trim() ?? "",
    b.email?.trim() ?? "",
    b.type ?? "customer",
    b.note?.trim() ?? "",
    id
  );
  const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(id);
  return NextResponse.json({ customer });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const used = db.prepare("SELECT COUNT(*) as c FROM ledger WHERE customer_id = ?").get(id) as { c: number };
  const journalUsed = db.prepare("SELECT COUNT(*) as c FROM journal_entries WHERE (debit_account_type = 'customer' AND debit_account_id = ?) OR (credit_account_type = 'customer' AND credit_account_id = ?)").get(id, id) as { c: number };
  if (used.c > 0 || journalUsed.c > 0)
    return NextResponse.json({ error: "HAS_TRANSACTIONS" }, { status: 400 });
  db.prepare("DELETE FROM customers WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
