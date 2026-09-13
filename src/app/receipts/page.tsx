"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Trash2 } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { formatDate, formatMoney, parseNum, todayISO } from "@/lib/format";
import { useQuickEntry } from "@/lib/quick-entry";
import type { Receipt } from "@/lib/types";
import { Badge, Btn, Confirm, DateInput, Empty, Field, NumInput, PageHeader, SearchBox, Segmented, Spinner, Tbl, TextInput } from "@/components/ui";
import { CurrencyPicker, CustomerPicker, SafePicker } from "@/components/pickers";
import MultiEntryModal from "@/components/MultiEntryModal";
import { PrintVoucherButton } from "@/components/PrintVoucher";
import { useData, useToast } from "@/components/app-providers";

interface Row {
  kind: "receive" | "pay";
  date: string;
  customer_id: number;
  safe_id: number;
  currency: string;
  amount: string;
  description: string;
}

const blank = (kind: "receive" | "pay" = "receive"): Row => ({
  kind, date: todayISO(), customer_id: 0, safe_id: 0, currency: "AFN", amount: "", description: "",
});

export default function ReceiptsPage() {
  const { t, locale } = useLang();
  const { toast } = useToast();
  const { refresh, safes } = useData();

  const [rows, setRows] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [kindFilter, setKindFilter] = useState<"" | "receive" | "pay">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [modal, setModal] = useState(false);
  const [defKind, setDefKind] = useState<"receive" | "pay">("receive");
  const [entry, setEntry] = useState<Row[]>([blank()]);
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState<{ id: number; voucher: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (kindFilter) sp.set("kind", kindFilter);
      if (q) sp.set("q", q);
      if (from) sp.set("from", from);
      if (to) sp.set("to", to);
      const d = await apiGet<{ receipts: Receipt[] }>(`/api/receipts?${sp}`);
      setRows(d.receipts);
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"), "error");
    } finally {
      setLoading(false);
    }
  }, [q, kindFilter, from, to, toast, t]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const openModal = (kind: "receive" | "pay") => {
    setDefKind(kind);
    setEntry([{ ...blank(kind), safe_id: safes[0]?.id ?? 0 }]);
    setModal(true);
  };

  useQuickEntry("receipt-receive", () => openModal("receive"));

  const submit = async () => {
    for (const [i, r] of entry.entries()) {
      if (!r.customer_id || !r.safe_id || !r.currency || parseNum(r.amount) <= 0) {
        toast(`${t("row")} ${i + 1}: ${t("fillRequired")}`, "error");
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await apiPost<{ voucher_no: string }>("/api/receipts", {
        rows: entry.map((r) => ({
          kind: r.kind, date: r.date, customer_id: r.customer_id, safe_id: r.safe_id,
          currency: r.currency, amount: parseNum(r.amount), description: r.description,
        })),
      });
      toast(`${t("saved")} — ${res.voucher_no}`, "success");
      setModal(false);
      setEntry([blank(defKind)]);
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
      await apiDelete(`/api/receipts/${confirm.id}`);
      toast(t("deleted"), "success");
      load();
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"), "error");
    }
  };

  const totals = entry.reduce<Record<string, number>>((acc, r) => {
    acc[r.currency] = (acc[r.currency] ?? 0) + parseNum(r.amount);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title={t("nav_receipts")}
        sub={t("multiHint")}
        actions={
          <>
            <Btn variant="success" onClick={() => openModal("receive")}><ArrowDownCircle size={16} /> {t("receiveReceipt")}</Btn>
            <Btn variant="warning" onClick={() => openModal("pay")}><ArrowUpCircle size={16} /> {t("payReceipt")}</Btn>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <SearchBox value={q} onChange={setQ} className="min-w-52 flex-1" />
        <Segmented
          value={kindFilter}
          onChange={setKindFilter}
          options={[
            { value: "", label: t("all") },
            { value: "receive", label: t("receiveReceipt") },
            { value: "pay", label: t("payReceipt") },
          ]}
        />
        <DateInput value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" title={t("from")} />
        <DateInput value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" title={t("to")} />
      </div>

      {loading ? <Spinner /> : rows.length === 0 ? <Empty /> : (
        <Tbl head={[t("voucherNo"), t("date"), t("type"), t("customer"), t("safe"), t("amount"), t("description"), t("actions")]}>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-bold text-slate-600" dir="ltr">{r.voucher_no}</td>
              <td className="whitespace-nowrap px-3 py-2 text-xs">{formatDate(r.date, locale)}</td>
              <td className="px-3 py-2">
                {r.kind === "receive"
                  ? <Badge color="green">{t("receiveReceipt")}</Badge>
                  : <Badge color="amber">{t("payReceipt")}</Badge>}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-xs font-semibold">{r.customer_name}</td>
              <td className="whitespace-nowrap px-3 py-2 text-xs">{r.safe_name}</td>
              <td className="whitespace-nowrap px-3 py-2 text-xs font-extrabold" dir="ltr">{formatMoney(r.amount, r.currency, locale)}</td>
              <td className="max-w-52 truncate px-3 py-2 text-xs text-slate-500">{r.description}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-0.5">
                  <PrintVoucherButton voucherNo={r.voucher_no} />
                  <Btn variant="ghost" size="sm" title={t("delete")} onClick={() => setConfirm({ id: r.id, voucher: r.voucher_no })}>
                    <Trash2 size={15} className="text-rose-500" />
                  </Btn>
                </div>
              </td>
            </tr>
          ))}
        </Tbl>
      )}

      {/* ── Multi-entry received/pay popup ── */}
      <MultiEntryModal
        open={modal}
        onClose={() => setModal(false)}
        title={defKind === "receive" ? t("receiveReceipt") : t("payReceipt")}
        rows={entry}
        setRows={setEntry}
        blankRow={() => blank(defKind)}
        submitting={submitting}
        onSubmit={submit}
        footer={
          <span className="text-xs font-bold text-slate-600" dir="ltr">
            {Object.entries(totals).filter(([, v]) => v > 0).map(([c, v]) => `${c} ${formatMoney(v, "", locale)}`).join(" + ") || `${t("total")}: 0`}
          </span>
        }
        renderRow={(r, idx, update) => (
          <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-3 lg:grid-cols-4">
            <Field label={t("type")} required>
              <Segmented
                value={r.kind}
                onChange={(v) => update({ kind: v })}
                options={[
                  { value: "receive", label: t("receiveReceipt") },
                  { value: "pay", label: t("payReceipt") },
                ]}
              />
            </Field>
            <Field label={t("date")} required><DateInput value={r.date} onChange={(e) => update({ date: e.target.value })} /></Field>
            <Field label={t("customer")} required><CustomerPicker value={r.customer_id} onChange={(v) => update({ customer_id: v })} /></Field>
            <Field label={t("safe")} required><SafePicker value={r.safe_id} onChange={(v) => update({ safe_id: v })} showBalances /></Field>
            <Field label={t("currency")} required><CurrencyPicker value={r.currency} onChange={(v) => update({ currency: v })} /></Field>
            <Field label={t("amount")} required><NumInput value={r.amount} onChange={(v) => update({ amount: v })} placeholder="0" /></Field>
            <Field label={t("description")} className="col-span-2"><TextInput value={r.description} onChange={(e) => update({ description: e.target.value })} /></Field>
          </div>
        )}
      />

      <Confirm open={!!confirm} onClose={() => setConfirm(null)} onYes={doDelete} danger
        message={`${t("confirmDelete")} (${confirm?.voucher})`} />
    </div>
  );
}
