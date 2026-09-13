"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { formatDate, formatMoney, formatNumber, parseNum, todayISO } from "@/lib/format";
import { useQuickEntry } from "@/lib/quick-entry";
import type { AccountRef, JournalEntry } from "@/lib/types";
import { AccountPicker, CurrencyPicker } from "@/components/pickers";
import MultiEntryModal from "@/components/MultiEntryModal";
import { PrintVoucherButton } from "@/components/PrintVoucher";
import { useData, useToast } from "@/components/app-providers";
import { Badge, Btn, Confirm, DateInput, Empty, Field, NumInput, PageHeader, SearchBox, Spinner, Tbl, TextInput } from "@/components/ui";

interface JournalRow {
  date: string;
  debit_account: AccountRef | null;
  credit_account: AccountRef | null;
  currency: string;
  amount: string;
  description: string;
  is_commission: boolean;
  is_suspicious: boolean;
}

const blankRow = (): JournalRow => ({
  date: todayISO(), debit_account: null, credit_account: null,
  currency: "AFN", amount: "", description: "", is_commission: false, is_suspicious: false,
});

interface JournalData {
  entries: JournalEntry[];
  totals: { currency: string; amount: number; count: number }[];
}

export default function JournalPage() {
  const { t, locale } = useLang();
  const { toast } = useToast();
  const { refresh } = useData();
  const [items, setItems] = useState<JournalEntry[]>([]);
  const [totals, setTotals] = useState<JournalData["totals"]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [currency, setCurrency] = useState("");
  const [modal, setModal] = useState(false);
  const [entry, setEntry] = useState<JournalRow[]>([blankRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState<JournalEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (q) sp.set("q", q);
      if (from) sp.set("from", from);
      if (to) sp.set("to", to);
      if (currency) sp.set("currency", currency);
      const data = await apiGet<JournalData>(`/api/journal?${sp.toString()}`);
      setItems(data.entries);
      setTotals(data.totals);
    } catch (error) {
      toast(error instanceof Error ? error.message : t("error"), "error");
    } finally {
      setLoading(false);
    }
  }, [q, from, to, currency, t, toast]);

  useEffect(() => {
    const timer = window.setTimeout(load, 220);
    return () => window.clearTimeout(timer);
  }, [load]);

  const openModal = () => {
    setEntry([blankRow()]);
    setModal(true);
  };
  useQuickEntry("journal", openModal);

  const submit = async () => {
    for (const [i, row] of entry.entries()) {
      if (!row.debit_account || !row.credit_account || !row.currency || parseNum(row.amount) <= 0) {
        toast(`${t("row")} ${locale === "fa" ? (i + 1).toLocaleString("fa-AF") : i + 1}: ${t("fillRequired")}`, "error");
        return;
      }
      if (row.debit_account.type === row.credit_account.type && row.debit_account.id === row.credit_account.id) {
        toast(`${t("row")} ${i + 1}: ${locale === "fa" ? "حساب دبت و کردت نمی‌تواند یکسان باشد" : "Debit and credit accounts cannot be the same"}`, "error");
        return;
      }
    }
    setSubmitting(true);
    try {
      const result = await apiPost<{ voucher_no: string }>("/api/journal", {
        rows: entry.map((row) => ({
          date: row.date, debit_account: row.debit_account, credit_account: row.credit_account,
          currency: row.currency, amount: parseNum(row.amount), description: row.description,
          is_commission: row.is_commission, is_suspicious: row.is_suspicious,
        })),
      });
      toast(`${t("saved")} — ${result.voucher_no}`, "success");
      setModal(false);
      setEntry([blankRow()]);
      await Promise.all([load(), refresh()]);
    } catch (error) {
      toast(error instanceof Error ? error.message : t("error"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async () => {
    if (!confirm) return;
    try {
      await apiDelete(`/api/journal/${confirm.id}`);
      toast(t("deleted"), "success");
      await Promise.all([load(), refresh()]);
    } catch (error) {
      toast(error instanceof Error ? error.message : t("error"), "error");
    }
  };

  const stagedTotals = useMemo(() => entry.reduce<Record<string, number>>((all, row) => {
    const value = parseNum(row.amount);
    if (value) all[row.currency] = (all[row.currency] ?? 0) + value;
    return all;
  }, {}), [entry]);

  return (
    <div>
      <PageHeader
        title={t("journal")}
        sub={t("journalHint")}
        actions={<Btn onClick={openModal}><Plus size={16} /> {t("newJournal")}</Btn>}
      />

      <div className="mb-3 flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <SearchBox value={q} onChange={setQ} className="min-w-48 flex-1" />
        <Field label={t("from")}><DateInput value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" /></Field>
        <Field label={t("to")}><DateInput value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" /></Field>
        <Field label={t("currency")}><select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500" dir="ltr"><option value="">{t("all")}</option><CurrencyOptions /></select></Field>
      </div>

      {totals.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {totals.map((item) => (
            <div key={item.currency} className="rounded-xl border border-teal-100 bg-teal-50 px-3 py-2 text-xs text-teal-800" dir="ltr">
              <b>{item.currency}</b> · {formatNumber(item.amount, locale)} <span className="text-teal-600">({locale === "fa" ? item.count.toLocaleString("fa-AF") : item.count} {t("transaction")})</span>
            </div>
          ))}
        </div>
      )}

      {loading ? <Spinner /> : items.length === 0 ? <Empty /> : (
        <Tbl head={[t("voucherNo"), t("date"), t("debitAccount"), t("creditAccount"), t("currency"), t("amount"), t("description"), t("status"), t("actions")]}> 
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-teal-50/30">
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-bold text-slate-600" dir="ltr">{item.voucher_no}</td>
              <td className="whitespace-nowrap px-3 py-2 text-xs">{formatDate(item.date, locale)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-emerald-800">{item.debit_account_name}</td>
              <td className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-rose-700">{item.credit_account_name}</td>
              <td className="px-3 py-2 text-xs font-bold" dir="ltr">{item.currency}</td>
              <td className="whitespace-nowrap px-3 py-2 text-xs font-extrabold" dir="ltr">{formatMoney(item.amount, item.currency, locale)}</td>
              <td className="max-w-64 truncate px-3 py-2 text-xs text-slate-500">{item.description || "—"}</td>
              <td className="px-3 py-2"><div className="flex gap-1">{item.is_commission ? <Badge color="purple">{t("commissionRelated")}</Badge> : null}{item.is_suspicious ? <Badge color="amber">{t("suspicious")}</Badge> : null}{!item.is_commission && !item.is_suspicious ? <Badge color="green">{t("confirmed")}</Badge> : null}</div></td>
              <td className="px-3 py-2"><div className="flex items-center gap-0.5"><PrintVoucherButton voucherNo={item.voucher_no} /><Btn variant="ghost" size="sm" title={t("delete")} onClick={() => setConfirm(item)}><Trash2 size={15} className="text-rose-500" /></Btn></div></td>
            </tr>
          ))}
        </Tbl>
      )}

      <MultiEntryModal
        open={modal}
        onClose={() => setModal(false)}
        title={t("newJournal")}
        rows={entry}
        setRows={setEntry}
        blankRow={blankRow}
        submitting={submitting}
        onSubmit={submit}
        footer={<span className="text-xs font-bold text-slate-600" dir="ltr">{Object.entries(stagedTotals).map(([cur, value]) => `${cur} ${formatMoney(value, "", locale)}`).join("  •  ") || `${t("total")}: 0`}</span>}
        renderRow={(row, _index, update) => (
          <div className="grid grid-cols-2 gap-3 pt-2 lg:grid-cols-4">
            <Field label={t("date")} required><DateInput value={row.date} onChange={(e) => update({ date: e.target.value })} /></Field>
            <Field label={t("debitAccount")} required><AccountPicker value={row.debit_account} onChange={(debit_account) => update({ debit_account })} exclude={row.credit_account} /></Field>
            <Field label={t("creditAccount")} required><AccountPicker value={row.credit_account} onChange={(credit_account) => update({ credit_account })} exclude={row.debit_account} /></Field>
            <Field label={t("currency")} required><CurrencyPicker value={row.currency} onChange={(currency) => update({ currency })} /></Field>
            <Field label={t("amount")} required><NumInput value={row.amount} onChange={(amount) => update({ amount })} placeholder="0" autoFocus /></Field>
            <Field label={t("description")} className="col-span-2"><TextInput value={row.description} onChange={(e) => update({ description: e.target.value })} placeholder={locale === "fa" ? "شرح معامله…" : "Transaction details…"} /></Field>
            <div className="col-span-2 flex flex-wrap items-end gap-2 lg:col-span-1">
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800"><input type="checkbox" checked={row.is_suspicious} onChange={(e) => update({ is_suspicious: e.target.checked })} className="accent-amber-600" />{t("suspicious")}</label>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800"><input type="checkbox" checked={row.is_commission} onChange={(e) => update({ is_commission: e.target.checked })} className="accent-violet-600" />{t("commissionRelated")}</label>
            </div>
          </div>
        )}
      />

      <Confirm open={!!confirm} onClose={() => setConfirm(null)} onYes={remove} danger message={`${t("confirmDelete")} (${confirm?.voucher_no})`} />
    </div>
  );
}

function CurrencyOptions() {
  const { currencies } = useData();
  return <>{currencies.map((currency) => <option key={currency.code} value={currency.code}>{currency.code}</option>)}</>;
}
