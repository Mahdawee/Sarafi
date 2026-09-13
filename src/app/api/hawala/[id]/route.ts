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
    amount: number; safe_id: number; date: string; sender_name: string; receiver_name: string;
  } | undefined;
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const today = todayISO();

  if (action === "pay") {
    if (row.status === "paid") return NextResponse.json({ error: "Already paid" }, { status: 400 });
    if (row.status === "cancelled") return NextResponse.json({ error: "Cancelled" }, { status: 400 });
    const safe_id = Number(b.safe_id ?? row.safe_id);
    if (!safe_id) return NextResponse.json({ error: "NO_SAFE" }, { status: 400 });
    db.prepare("UPDATE hawala SET status = 'paid', paid_at = ?, safe_id = ? WHERE id = ?").run(today, safe_id, id);
    addSafeMove(db, {
      voucher_no: row.voucher_no, date: today, safe_id, currency: row.currency, amount: -row.amount,
      description: row.kind === "send" ? `پرداخت حواله ارسالی ${row.voucher_no}` : `پرداخت حواله دریافتی ${row.voucher_no}`,
      ref_type: "hawala_pay", ref_id: row.id,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "unpay") {
    if (row.status !== "paid") return NextResponse.json({ error: "Not paid" }, { status: 400 });
    db.prepare("DELETE FROM safe_movements WHERE ref_type = 'hawala_pay' AND ref_id = ?").run(row.id);
    db.prepare("UPDATE hawala SET status = 'pending', paid_at = '' WHERE id = ?").run(id);
    return NextResponse.json({ ok: true });
  }

  if (action === "cancel") {
    if (row.status === "paid") return NextResponse.json({ error: "PAID_FIRST_UNPAY" }, { status: 400 });
    db.prepare("UPDATE hawala SET status = 'cancelled' WHERE id = ?").run(id);
    return NextResponse.json({ ok: true });
  }

  if (action === "restore") {
    db.prepare("UPDATE hawala SET status = 'pending' WHERE id = ?").run(id);
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
    db.prepare("DELETE FROM hawala WHERE id = ?").run(id);
  });
  tx();
  return NextResponse.json({ ok: true });
}
