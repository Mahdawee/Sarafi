import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  if (b.confirm !== "DELETE") return NextResponse.json({ error: "Not confirmed" }, { status: 400 });
  const db = getDb();
  const tx = db.transaction(() => {
    for (const t of ["ledger", "safe_movements", "hawala", "receipts", "debit_credit", "exchanges",
      "expenses", "transfers", "journal_entries", "rate_history", "customers", "safes", "counters"]) {
      db.prepare(`DELETE FROM ${t}`).run();
    }
    // A true reset should also make the first customer/safe IDs predictable.
    db.prepare("DELETE FROM sqlite_sequence").run();
    db.prepare("INSERT INTO safes (name, type, account_no) VALUES (?, ?, ?)").run("صندوق مرکزی", "cash", "");
    db.prepare("INSERT INTO safes (name, type, account_no) VALUES (?, ?, ?)").run("بانک", "bank", "");
  });
  tx();
  return NextResponse.json({ ok: true });
}
