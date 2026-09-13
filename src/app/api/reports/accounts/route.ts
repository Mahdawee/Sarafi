import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Lightweight unified accounts endpoint for integrations and future mobile UI. */
export async function GET(req: NextRequest) {
  const db = getDb();
  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  const like = `%${q}%`;
  const customers = db.prepare(`SELECT id, code, name, type FROM customers WHERE is_active = 1 ${q ? "AND (name LIKE ? OR code LIKE ?)" : ""} ORDER BY name`).all(...(q ? [like, like] : []));
  const safes = db.prepare(`SELECT id, name, type, account_no FROM safes WHERE is_active = 1 ${q ? "AND (name LIKE ? OR account_no LIKE ?)" : ""} ORDER BY name`).all(...(q ? [like, like] : []));
  return NextResponse.json({ customers, safes });
}
