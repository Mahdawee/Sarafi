import { NextRequest, NextResponse } from "next/server";
import { getDb, getAllSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ settings: getAllSettings(getDb()) });
}

export async function PUT(req: NextRequest) {
  const db = getDb();
  const b = (await req.json()) as Record<string, string>;
  const stmt = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?");
  const tx = db.transaction(() => {
    for (const [k, v] of Object.entries(b)) stmt.run(k, String(v ?? ""), String(v ?? ""));
  });
  tx();
  return NextResponse.json({ settings: getAllSettings(db) });
}
