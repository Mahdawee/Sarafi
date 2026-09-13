import { NextRequest, NextResponse } from "next/server";
import { getDb, deleteRefLinks } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const row = db.prepare("SELECT id FROM exchanges WHERE id = ?").get(id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const tx = db.transaction(() => {
    deleteRefLinks(db, "exchange", Number(id));
    db.prepare("DELETE FROM exchanges WHERE id = ?").run(id);
  });
  tx();
  return NextResponse.json({ ok: true });
}
