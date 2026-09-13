import { NextRequest, NextResponse } from "next/server";
import { getDb, todayISO } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  const date = req.nextUrl.searchParams.get("date") || todayISO();
  const sends = db.prepare(`SELECT h.*, c.name as customer_name FROM hawala h LEFT JOIN customers c ON c.id = h.customer_id WHERE h.kind='send' AND h.date = ? ORDER BY h.id`).all(date);
  const receives = db.prepare(`SELECT h.*, c.name as customer_name FROM hawala h LEFT JOIN customers c ON c.id = h.customer_id WHERE h.kind='receive' AND h.date = ? ORDER BY h.id`).all(date);
  const receipts = db.prepare(`SELECT r.*, c.name as customer_name, s.name as safe_name FROM receipts r LEFT JOIN customers c ON c.id = r.customer_id LEFT JOIN safes s ON s.id = r.safe_id WHERE r.date = ? ORDER BY r.id`).all(date);
  const dc = db.prepare(`SELECT d.*, c.name as customer_name FROM debit_credit d LEFT JOIN customers c ON c.id = d.customer_id WHERE d.date = ? ORDER BY d.id`).all(date);
  const exchanges = db.prepare(`SELECT e.*, c.name as customer_name FROM exchanges e LEFT JOIN customers c ON c.id = e.customer_id WHERE e.date = ? ORDER BY e.id`).all(date);
  const expenses = db.prepare(`SELECT e.*, s.name as safe_name FROM expenses e LEFT JOIN safes s ON s.id = e.safe_id WHERE e.date = ? ORDER BY e.id`).all(date);
  const transfers = db.prepare(`SELECT t.*, fs.name as from_safe_name, ts.name as to_safe_name FROM transfers t LEFT JOIN safes fs ON fs.id = t.from_safe LEFT JOIN safes ts ON ts.id = t.to_safe WHERE t.date = ? ORDER BY t.id`).all(date);
  return NextResponse.json({ date, sends, receives, receipts, dc, exchanges, expenses, transfers });
}
