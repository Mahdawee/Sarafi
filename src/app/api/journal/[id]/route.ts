import { NextRequest, NextResponse } from "next/server";
import { deleteRefLinks, getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Delete one journal row and its two generated account postings. */
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const row = db.prepare("SELECT id FROM journal_entries WHERE id = ?").get(id) as { id: number } | undefined;
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const tx = db.transaction(() => {
    deleteRefLinks(db, "journal", row.id);
    db.prepare("DELETE FROM journal_entries WHERE id = ?").run(row.id);
  });
  tx();
  return NextResponse.json({ ok: true });
}
