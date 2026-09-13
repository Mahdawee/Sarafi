"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useLang, type DictKey } from "@/lib/i18n";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { formatDate, formatMoney, parseNum, todayISO } from "@/lib/format";
import { useQuickEntry } from "@/lib/quick-entry";
import type { Expense } from "@/lib/types";
import { Btn, Confirm, DateInput, Empty, Field, NumInput, PageHeader, SearchBox, Select, Spinner, Tbl, TextInput } from "@/components/ui";
import { CurrencyPicker, SafePicker } from "@/components/pickers";
import MultiEntryModal from "@/components/MultiEntryModal";
import { PrintVoucherButton } from "@/components/PrintVoucher";
import { useData, useToast } from "@/components/app-providers";

interface Row { date: string; category: string; safe_id: number; currency: string; amount: string; description: string }
const blank = (): Row => ({ date: todayISO(), category: "other", safe_id: 0, currency: "AFN", amount: "", description: "" });

const CATS: DictKey[] = ["cat_rent", "cat_salary", "cat_food", "cat_transport", "cat_utility", "cat_other"];

export default function ExpensesPage() {
  const { t, locale } = useLang();
  const { toast } = useToast();
  const { refresh, safes } = useData();
  const [rows, setRows] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(false);
  const [entry, setEntry] = useState<Row[]>([blank()]);
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState<{ id: number; voucher: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = q ? `?q=${encodeURIComponent(q)}` : "";
      const d = await apiGet<{ expenses: Expense[] }>(`/api/expenses${sp}`);
      setRows(d.expenses);
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"), "error");
    } finally {
      setLoading(false);
    }
  }, [q, toast, t]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const openModal = useCallback(() => {
    setEntry([{ ...blank(), safe_id: safes[0]?.id ?? 0 }]);
    setModal(true);
  }, [safes]);
  useQuickEntry("expense", openModal);

  const submit = async () => {
    for (const [i, r] of entry.entries()) {
      if (!r.safe_id || !r.currency || parseNum(r.amount) <= 0) {
        toast(`${t("row")} ${i + 1}: ${t("fillRequired")}`, "error");
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await apiPost<{ voucher_no: string }>("/api/expenses", {
        rows: entry.map((r) => ({ date: r.date, category: r.category, safe_id: r.safe_id, currency: r.currency, amount: parseNum(r.amount), description: r.description })),
      });
      toast(`${t("saved")} — ${res.voucher_no}`, "success");
      setModal(false);
      setEntry([blank()]);
      load();
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const doDelete = async () => {
    if (!confirm) return;
    try {
      await apiDelete(`/api/expenses/${confirm.id}`);
      toast(t("deleted"), "success");
      load();
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"), "error");
    }
  };

  const catLabel = (c: string) => {
    const k = `cat_${c}` as DictKey;
    try { return t(k); } catch { return c; }
  };

  return (
    <div>
      <PageHeader
        title={t("nav_expenses")}
        sub={t("multiHint")}
        actions={<Btn onClick={openModal}><Plus size={16} /> {t("newExpense")}</Btn>}
      />
      <div className="mb-3"><SearchBox value={q} onChange={setQ} className="max-w-md" /></div>

      {loading ? <Spinner /> : rows.length === 0 ? <Empty /> : (
        <Tbl head={[t("voucherNo"), t("date"), t("category"), t("safe"), t("amount"), t("description"), t("actions")]}>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-bold text-slate-600" dir="ltr">{r.voucher_no}</td>
              <td className="whitespace-nowrap px-3 py-2 text-xs">{formatDate(r.date, locale)}</td>
              <td className="px-3 py-2 text-xs">{catLabel(r.category)}</td>
              <td className="px-3 py-2 text-xs">{r.safe_name}</td>
              <td className="whitespace-nowrap px-3 py-2 text-xs font-extrabold" dir="ltr">{formatMoney(r.amount, r.currency, locale)}</td>
              <td className="max-w-56 truncate px-3 py-2 text-xs text-slate-500">{r.description}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-0.5">
                  <PrintVoucherButton voucherNo={r.voucher_no} />
                  <Btn variant="ghost" size="sm" onClick={() => setConfirm({ id: r.id, voucher: r.voucher_no })}>
                    <Trash2 size={15} className="text-rose-500" />
                  </Btn>
                </div>
              </td>
            </tr>
          ))}
        </Tbl>
      )}

      <MultiEntryModal
        open={modal} onClose={() => setModal(false)} title={t("newExpense")}
        rows={entry} setRows={setEntry} blankRow={blank} submitting={submitting} onSubmit={submit}
        renderRow={(r, idx, update) => (
          <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-3">
            <Field label={t("date")} required><DateInput value={r.date} onChange={(e) => update({ date: e.target.value })} /></Field>
            <Field label={t("category")}>
              <Select value={r.category} onChange={(e) => update({ category: e.target.value })}>
                {CATS.map((c) => <option key={c} value={c.replace("cat_", "")}>{t(c)}</option>)}
              </Select>
            </Field>
            <Field label={t("safe")} required><SafePicker value={r.safe_id} onChange={(v) => update({ safe_id: v })} showBalances /></Field>
            <Field label={t("currency")} required><CurrencyPicker value={r.currency} onChange={(v) => update({ currency: v })} /></Field>
            <Field label={t("amount")} required><NumInput value={r.amount} onChange={(v) => update({ amount: v })} placeholder="0" /></Field>
            <Field label={t("description")}><TextInput value={r.description} onChange={(e) => update({ description: e.target.value })} /></Field>
          </div>
        )}
      />

      <Confirm open={!!confirm} onClose={() => setConfirm(null)} onYes={doDelete} danger
        message={`${t("confirmDelete")} (${confirm?.voucher})`} />
    </div>
  );
}
