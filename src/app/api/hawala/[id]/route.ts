import { NextRequest, NextResponse } from "next/server";
import { getDb, addSafeMove, deleteRefLinks, todayISO } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const b = await req.json();
  const action = b.action as string;
  const row = db.prepare("SELECT * FROM hawala WHERE id = ?").get(id) as {
    id: number; voucher_no: string; kind: string; status: string; currency: string;
    amount: number; received_currency?: string; received_amount?: number; safe_id: number; date: string; sender_name: string; receiver_name: string;
  } | undefined;
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const today = todayISO();

  if (action === "pay") {
    if (row.status === "paid") return NextResponse.json({ error: "Already paid" }, { status: 400 });
    if (row.status === "cancelled") return NextResponse.json({ error: "Cancelled" }, { status: 400 });
    const safe_id = Number(b.safe_id ?? row.safe_id);
    if (!safe_id) return NextResponse.json({ error: "NO_SAFE" }, { status: 400 });
    if (!db.prepare("SELECT 1 FROM safes WHERE id = ?").get(safe_id))
      return NextResponse.json({ error: "Selected safe no longer exists" }, { status: 400 });
    const tx = db.transaction(() => {
      db.prepare("UPDATE hawala SET status = 'paid', paid_at = ?, safe_id = ? WHERE id = ?").run(today, safe_id, id);
      addSafeMove(db, {
        voucher_no: row.voucher_no, date: today, safe_id,
        currency: row.received_currency || row.currency,
        amount: -(Number(row.received_amount) > 0 ? Number(row.received_amount) : row.amount),
        description: row.kind === "send" ? `پرداخت حواله ارسالی ${row.voucher_no}` : `پرداخت حواله دریافتی ${row.voucher_no}`,
        ref_type: "hawala_pay", ref_id: row.id,
      });
    });
    tx();
    return NextResponse.json({ ok: true });
  }

  if (action === "unpay") {
    if (row.status !== "paid") return NextResponse.json({ error: "Not paid" }, { status: 400 });
    const tx = db.transaction(() => {
      db.prepare("DELETE FROM safe_movements WHERE ref_type = 'hawala_pay' AND ref_id = ?").run(row.id);
      db.prepare("UPDATE hawala SET status = 'pending', paid_at = '' WHERE id = ?").run(id);
    });
    tx();
    return NextResponse.json({ ok: true });
  }

  if (action === "cancel") {
    if (row.status === "paid") return NextResponse.json({ error: "PAID_FIRST_UNPAY" }, { status: 400 });
    if (row.status === "cancelled") return NextResponse.json({ error: "Already cancelled" }, { status: 400 });
    const originalType = row.kind === "send" ? "hawala_send" : "hawala_receive";
    // Preserve an audit trail instead of silently deleting financial history:
    // create exact reversing postings under a dedicated cancel reference.
    const ledgerRows = db.prepare("SELECT * FROM ledger WHERE ref_type = ? AND ref_id = ?").all(originalType, row.id) as {
      customer_id: number; currency: string; debit: number; credit: number; description: string;
    }[];
    const safeRows = db.prepare("SELECT * FROM safe_movements WHERE ref_type = ? AND ref_id = ?").all(originalType, row.id) as {
      safe_id: number; currency: string; amount: number; description: string;
    }[];
    const tx = db.transaction(() => {
      for (const entry of ledgerRows) {
        db.prepare(`INSERT INTO ledger (voucher_no, date, customer_id, currency, debit, credit, description, ref_type, ref_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'hawala_cancel', ?)`)
          .run(row.voucher_no, today, entry.customer_id, entry.currency, entry.credit, entry.debit, `لغو ${entry.description}`, row.id);
      }
      for (const move of safeRows) {
        db.prepare(`INSERT INTO safe_movements (voucher_no, date, safe_id, currency, amount, description, ref_type, ref_id)
          VALUES (?, ?, ?, ?, ?, ?, 'hawala_cancel', ?)`)
          .run(row.voucher_no, today, move.safe_id, move.currency, -move.amount, `لغو ${move.description}`, row.id);
      }
      db.prepare("UPDATE hawala SET status = 'cancelled' WHERE id = ?").run(id);
    });
    tx();
    return NextResponse.json({ ok: true });
  }

  if (action === "restore") {
    if (row.status !== "cancelled") return NextResponse.json({ error: "Not cancelled" }, { status: 400 });
    const tx = db.transaction(() => {
      deleteRefLinks(db, "hawala_cancel", row.id);
      db.prepare("UPDATE hawala SET status = 'pending' WHERE id = ?").run(id);
    });
    tx();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const row = db.prepare("SELECT * FROM hawala WHERE id = ?").get(id) as { id: number; kind: string } | undefined;
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const tx = db.transaction(() => {
    deleteRefLinks(db, row.kind === "send" ? "hawala_send" : "hawala_receive", row.id);
    deleteRefLinks(db, "hawala_pay", row.id);
    deleteRefLinks(db, "hawala_cancel", row.id);
    db.prepare("DELETE FROM hawala WHERE id = ?").run(id);
  });
  tx();
  return NextResponse.json({ ok: true });
}
