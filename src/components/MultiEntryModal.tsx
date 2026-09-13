"use client";

import React from "react";
import { Copy, Plus, Save, Trash2 } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { Btn, Modal } from "./ui";

export interface MultiEntryModalProps<T> {
  open: boolean;
  onClose: () => void;
  title: string;
  rows: T[];
  setRows: (rows: T[]) => void;
  blankRow: () => T;
  renderRow: (row: T, idx: number, update: (patch: Partial<T>) => void) => React.ReactNode;
  onSubmit: () => Promise<void>;
  submitting: boolean;
  footer?: React.ReactNode;
  validate?: (rows: T[]) => string | null;
  submitLabel?: string;
}

/**
 * Generic multi-row entry popup.
 * Users add as many rows as needed, then press ONE Save button to submit all.
 * Used by: Send Hawala, Receive Hawala, Receipts, Debit/Credit, Exchange, Expenses, Transfers.
 */
export default function MultiEntryModal<T>({
  open, onClose, title, rows, setRows, blankRow, renderRow, onSubmit, submitting, footer, submitLabel,
}: MultiEntryModalProps<T>) {
  const { t, locale } = useLang();

  const update = (idx: number, patch: Partial<T>) => {
    setRows(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const addRow = () => setRows([...rows, blankRow()]);
  const removeRow = (idx: number) => {
    if (rows.length === 1) setRows([blankRow()]);
    else setRows(rows.filter((_, i) => i !== idx));
  };
  const dupRow = (idx: number) => {
    const copy = { ...rows[idx] };
    const next = [...rows];
    next.splice(idx + 1, 0, copy);
    setRows(next);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      wide
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Btn variant="secondary" onClick={addRow}>
              <Plus size={16} /> {t("addRow")}
            </Btn>
            {footer}
          </div>
          <div className="flex items-center gap-2">
            <Btn variant="ghost" onClick={onClose}>{t("cancel")}</Btn>
            <Btn onClick={onSubmit} disabled={submitting || rows.length === 0} size="lg" className="min-w-36">
              <Save size={18} /> {submitting ? t("saving") : submitLabel ?? t("save")}
            </Btn>
          </div>
        </div>
      }
    >
      <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{t("multiHint")}</p>
      <div className="space-y-3">
        {rows.map((row, idx) => (
          <div key={idx} className="relative rounded-2xl border border-slate-200 bg-slate-50/60 p-3 pt-4">
            <div className="absolute -top-2.5 start-3 flex items-center gap-1.5">
              <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[11px] font-bold text-white">
                {t("row")} {locale === "fa" ? (idx + 1).toLocaleString("fa-AF") : idx + 1}
              </span>
            </div>
            <div className="absolute end-2 top-2 flex items-center gap-1">
              <button
                onClick={() => dupRow(idx)}
                title={locale === "fa" ? "کاپی سطر" : "Duplicate row"}
                className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-blue-100 hover:text-blue-600"
              >
                <Copy size={15} />
              </button>
              <button
                onClick={() => removeRow(idx)}
                title={t("delete")}
                className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600"
              >
                <Trash2 size={15} />
              </button>
            </div>
            {renderRow(row, idx, (patch) => update(idx, patch))}
          </div>
        ))}
      </div>
    </Modal>
  );
}
