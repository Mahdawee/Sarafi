"use client";

import React, { useCallback, useEffect, useState } from "react";
import { MinusCircle, Plus, PlusCircle, Trash2 } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { formatDate, formatMoney, parseNum, todayISO } from "@/lib/format";
import type { DebitCredit } from "@/lib/types";
import { Badge, Btn, Confirm, DateInput, Empty, Field, NumInput, PageHeader, SearchBox, Segmented, Spinner, Tbl, TextInput } from "@/components/ui";
import { CurrencyPicker, CustomerPicker } from "@/components/pickers";
import MultiEntryModal from "@/components/MultiEntryModal";
import { PrintVoucherButton } from "@/components/PrintVoucher";
import { useData, useToast } from "@/components/app-providers";

interface Row {
  kind: "debit" | "credit";
  date: string;
  customer_id: number;
  currency: string;
  amount: string;
  reason: string;
}

const blank = (kind: "debit" | "credit" = "debit"): Row => ({
  kind, date: todayISO(), customer_id: 0, currency: "AFN", amount: "", reason: "",
});

export default function DebitCreditPage() {
  const { t, locale } = useLang();
  const { toast } = useToast();
  const { refresh } = useData();

  const [rows, setRows] = useState<DebitCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [kindFilter, setKindFilter] = useState<"" | "debit" | "credit">("");

  const [modal, setModal] = useState(false);
  const [defKind, setDefKind] = useState<"debit" | "credit">("debit");
  const [entry, setEntry] = useState<Row[]>([blank()]);
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState<{ id: number; voucher: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (kindFilter) sp.set("kind", kindFilter);
      if (q) sp.set("q", q);
      const d = await apiGet<{ items: DebitCredit[] }>(`/api/debit-credit?${sp}`);
      setRows(d.items);
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"), "error");
    } finally {
      setLoading(false);
    }
  }, [q, kindFilter, toast, t]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const openModal = (kind: "debit" | "credit") => {
    setDefKind(kind);
    setEntry([blank(kind)]);
    setModal(true);
  };

  const submit = async () => {
    for (const [i, r] of entry.entries()) {
      if (!r.customer_id || !r.currency || parseNum(r.amount) <= 0) {
        toast(`${t("row")} ${i + 1}: ${t("fillRequired")}`, "error");
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await apiPost<{ voucher_no: string }>("/api/debit-credit", {
        rows: entry.map((r) => ({
          kind: r.kind, date: r.date, customer_id: r.customer_id,
          currency: r.currency, amount: parseNum(r.amount), reason: r.reason,
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
      await apiDelete(`/api/debit-credit/${confirm.id}`);
      toast(t("deleted"), "success");
      load();
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"), "error");
    }
  };

  return (
    <div>
      <PageHeader
        title={t("nav_debit_credit")}
        sub={t("multiHint")}
        actions={
          <>
            <Btn variant="danger" onClick={() => openModal("debit")}><MinusCircle size={16} /> {t("debitNote")}</Btn>
            <Btn variant="success" onClick={() => openModal("credit")}><PlusCircle size={16} /> {t("creditNote")}</Btn>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={setQ} className="min-w-52 flex-1" />
        <Segmented
          value={kindFilter}
          onChange={setKindFilter}
          options={[
            { value: "", label: t("all") },
            { value: "debit", label: t("debit") },
            { value: "credit", label: t("credit") },
          ]}
        />
      </div>

      {loading ? <Spinner /> : rows.length === 0 ? <Empty /> : (
        <Tbl head={[t("voucherNo"), t("date"), t("type"), t("customer"), t("amount"), t("reason"), t("actions")]}>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-bold text-slate-600" dir="ltr">{r.voucher_no}</td>
              <td className="whitespace-nowrap px-3 py-2 text-xs">{formatDate(r.date, locale)}</td>
              <td className="px-3 py-2">
                {r.kind === "debit" ? <Badge color="red">{t("debit")}</Badge> : <Badge color="green">{t("credit")}</Badge>}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-xs font-semibold">{r.customer_name}</td>
              <td className="whitespace-nowrap px-3 py-2 text-xs font-extrabold" dir="ltr">{formatMoney(r.amount, r.currency, locale)}</td>
              <td className="max-w-60 truncate px-3 py-2 text-xs text-slate-500">{r.reason}</td>
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

      {/* ── Multi-entry debit/credit popup ── */}
      <MultiEntryModal
        open={modal}
        onClose={() => setModal(false)}
        title={defKind === "debit" ? t("debitNote") : t("creditNote")}
        rows={entry}
        setRows={setEntry}
        blankRow={() => blank(defKind)}
        submitting={submitting}
        onSubmit={submit}
        renderRow={(r, idx, update) => (
          <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-3 lg:grid-cols-4">
            <Field label={t("type")} required>
              <Segmented
                value={r.kind}
                onChange={(v) => update({ kind: v })}
                options={[
                  { value: "debit", label: t("debit") },
                  { value: "credit", label: t("credit") },
                ]}
              />
            </Field>
            <Field label={t("date")} required><DateInput value={r.date} onChange={(e) => update({ date: e.target.value })} /></Field>
            <Field label={t("customer")} required><CustomerPicker value={r.customer_id} onChange={(v) => update({ customer_id: v })} /></Field>
            <Field label={t("currency")} required><CurrencyPicker value={r.currency} onChange={(v) => update({ currency: v })} /></Field>
            <Field label={t("amount")} required><NumInput value={r.amount} onChange={(v) => update({ amount: v })} placeholder="0" /></Field>
            <Field label={t("reason")} className="col-span-2 sm:col-span-2"><TextInput value={r.reason} onChange={(e) => update({ reason: e.target.value })} /></Field>
          </div>
        )}
      />

      <Confirm open={!!confirm} onClose={() => setConfirm(null)} onYes={doDelete} danger
        message={`${t("confirmDelete")} (${confirm?.voucher})`} />
    </div>
  );
}
