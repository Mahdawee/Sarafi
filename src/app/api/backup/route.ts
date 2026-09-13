import { NextResponse } from "next/server";
import { getDb, todayISO } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const tables = ["customers", "safes", "currencies", "counters", "ledger", "safe_movements", "hawala",
    "receipts", "debit_credit", "exchanges", "expenses", "transfers", "journal_entries", "rate_history", "settings"];
  const data: Record<string, unknown> = { _backup_date: todayISO(), _app: "sarafi" };
  for (const t of tables) data[t] = db.prepare(`SELECT * FROM ${t}`).all();
  return new NextResponse(JSON.stringify(data, null, 1), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="sarafi-backup-${todayISO()}.json"`,
    },
  });
}
