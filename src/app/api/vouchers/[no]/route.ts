import { NextRequest, NextResponse } from "next/server";
import { getDb, deleteVoucherLinks } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Get all rows of a voucher (for print) */
export async function GET(_: NextRequest, { params }: { params: Promise<{ no: string }> }) {
  const db = getDb();
  const { no } = await params;
  const hawala = db.prepare(`SELECT h.*, c.name as customer_name, s.name as safe_name,
    COALESCE(fc.name, fs.name, '') as from_account_name,
    COALESCE(tc.name, ts.name, '') as to_account_name
    FROM hawala h
    LEFT JOIN customers c ON c.id = h.customer_id
    LEFT JOIN safes s ON s.id = h.safe_id
    LEFT JOIN customers fc ON h.from_account_type = 'customer' AND fc.id = h.from_account_id
    LEFT JOIN safes fs ON h.from_account_type = 'safe' AND fs.id = h.from_account_id
    LEFT JOIN customers tc ON h.to_account_type = 'customer' AND tc.id = h.to_account_id
    LEFT JOIN safes ts ON h.to_account_type = 'safe' AND ts.id = h.to_account_id
    WHERE h.voucher_no = ? ORDER BY h.id`).all(no);
  const receipts = db.prepare(`SELECT r.*, c.name as customer_name, s.name as safe_name FROM receipts r LEFT JOIN customers c ON c.id = r.customer_id LEFT JOIN safes s ON s.id = r.safe_id WHERE r.voucher_no = ? ORDER BY r.id`).all(no);
  const dc = db.prepare(`SELECT d.*, c.name as customer_name FROM debit_credit d LEFT JOIN customers c ON c.id = d.customer_id WHERE d.voucher_no = ? ORDER BY d.id`).all(no);
  const exchanges = db.prepare(`SELECT e.*, c.name as customer_name, sf.name as safe_foreign_name, sb.name as safe_base_name FROM exchanges e LEFT JOIN customers c ON c.id = e.customer_id LEFT JOIN safes sf ON sf.id = e.safe_foreign LEFT JOIN safes sb ON sb.id = e.safe_base WHERE e.voucher_no = ? ORDER BY e.id`).all(no);
  const expenses = db.prepare(`SELECT e.*, s.name as safe_name FROM expenses e LEFT JOIN safes s ON s.id = e.safe_id WHERE e.voucher_no = ? ORDER BY e.id`).all(no);
  const transfers = db.prepare(`SELECT t.*, fs.name as from_safe_name, ts.name as to_safe_name FROM transfers t LEFT JOIN safes fs ON fs.id = t.from_safe LEFT JOIN safes ts ON ts.id = t.to_safe WHERE t.voucher_no = ? ORDER BY t.id`).all(no);
  const journal = db.prepare(`SELECT je.*, COALESCE(dc.name, ds.name, '') as debit_account_name, COALESCE(cc.name, cs.name, '') as credit_account_name
    FROM journal_entries je
    LEFT JOIN customers dc ON je.debit_account_type = 'customer' AND dc.id = je.debit_account_id
    LEFT JOIN safes ds ON je.debit_account_type = 'safe' AND ds.id = je.debit_account_id
    LEFT JOIN customers cc ON je.credit_account_type = 'customer' AND cc.id = je.credit_account_id
    LEFT JOIN safes cs ON je.credit_account_type = 'safe' AND cs.id = je.credit_account_id
    WHERE je.voucher_no = ? ORDER BY je.id`).all(no);
  return NextResponse.json({ voucher_no: no, hawala, receipts, dc, exchanges, expenses, transfers, journal });
}

/** Delete a whole voucher with all its ledger/safe links */
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ no: string }> }) {
  const db = getDb();
  const { no } = await params;
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM hawala WHERE voucher_no = ?").run(no);
    db.prepare("DELETE FROM receipts WHERE voucher_no = ?").run(no);
    db.prepare("DELETE FROM debit_credit WHERE voucher_no = ?").run(no);
    db.prepare("DELETE FROM exchanges WHERE voucher_no = ?").run(no);
    db.prepare("DELETE FROM expenses WHERE voucher_no = ?").run(no);
    db.prepare("DELETE FROM transfers WHERE voucher_no = ?").run(no);
    db.prepare("DELETE FROM journal_entries WHERE voucher_no = ?").run(no);
    deleteVoucherLinks(db, no);
  });
  tx();
  return NextResponse.json({ ok: true });
}
