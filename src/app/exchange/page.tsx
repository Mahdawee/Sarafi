"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ArrowDownUp, Plus, Trash2 } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { formatDate, formatMoney, parseNum, todayISO } from "@/lib/format";
import type { Exchange } from "@/lib/types";
import { Badge, Btn, Confirm, DateInput, Empty, Field, NumInput, PageHeader, Segmented, Spinner, Tbl, TextInput } from "@/components/ui";
import { CurrencyPicker, CustomerPicker, SafePicker } from "@/components/pickers";
import MultiEntryModal from "@/components/MultiEntryModal";
import { PrintVoucherButton } from "@/components/PrintVoucher";
import { useData, useToast } from "@/components/app-providers";

interface Row {
  kind: "buy" | "sell";
  date: string;
  customer_id: number;
  foreign_currency: string;
  foreign_amount: string;
  rate: string;
  safe_foreign: number;
  safe_base: number;
  note: string;
}

const blank = (kind: "buy" | "sell" = "buy"): Row => ({
  kind, date: todayISO(), customer_id: 0, foreign_currency: "USD", foreign_amount: "", rate: "",
  safe_foreign: 0, safe_base: 0, note: "",
});

export default function ExchangePage() {
  const { t, locale } = useLang();
  const { toast } = useToast();
  const { refresh, safes, currencies } = useData();

  const [rows, setRows] = useState<Exchange[]>([]);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState<"" | "buy" | "sell">("");

  const [modal, setModal] = useState(false);
  const [defKind, setDefKind] = useState<"buy" | "sell">("buy");
  const [entry, setEntry] = useState<Row[]>([blank()]);
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState<{ id: number; voucher: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (kindFilter) sp.set("kind", kindFilter);
      const d = await apiGet<{ exchanges: Exchange[] }>(`/api/exchanges?${sp}`);
      setRows(d.exchanges);
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"), "error");
    } finally {
      setLoading(false);
    }
  }, [kindFilter, toast, t]);

  useEffect(() => { load(); }, [load]);

  const rateFor = (code: string, kind: "buy" | "sell") => {
    const c = currencies.find((x) => x.code === code);
    if (!c) return "";
    return String(kind === "buy" ? c.buy_rate : c.sell_rate);
  };

  const openModal = (kind: "buy" | "sell") => {
    setDefKind(kind);
    setEntry([{ ...blank(kind), rate: rateFor("USD", kind), safe_foreign: safes[0]?.id ?? 0, safe_base: safes[0]?.id ?? 0 }]);
    setModal(true);
  };

  const submit = async () => {
    for (const [i, r] of entry.entries()) {
      if (!r.foreign_currency || parseNum(r.foreign_amount) <= 0 || parseNum(r.rate) <= 0 || !r.safe_foreign || !r.safe_base) {
        toast(`${t("row")} ${i + 1}: ${t("fillRequired")}`, "error");
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await apiPost<{ voucher_no: string }>("/api/exchanges", {
        rows: entry.map((r) => ({
          kind: r.kind, date: r.date, customer_id: r.customer_id,
          foreign_currency: r.foreign_currency, foreign_amount: parseNum(r.foreign_amount),
          rate: parseNum(r.rate), safe_foreign: r.safe_foreign, safe_base: r.safe_base, note: r.note,
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
      await apiDelete(`/api/exchanges/${confirm.id}`);
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
        title={t("nav_exchange")}
        sub={t("multiHint")}
        actions={
          <>
            <Btn variant="success" onClick={() => openModal("buy")}><ArrowDownUp size={16} /> {t("buyCurrency")}</Btn>
            <Btn variant="warning" onClick={() => openModal("sell")}><ArrowDownUp size={16} /> {t("sellCurrency")}</Btn>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented
          value={kindFilter}
          onChange={setKindFilter}
          options={[
            { value: "", label: t("all") },
            { value: "buy", label: t("buyCurrency") },
            { value: "sell", label: t("sellCurrency") },
          ]}
        />
      </div>

      {loading ? <Spinner /> : rows.length === 0 ? <Empty /> : (
        <Tbl head={[t("voucherNo"), t("date"), t("type"), t("foreignCurrency"), t("rate"), t("baseAmount"), t("profit"), t("customer"), t("actions")]}>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-bold text-slate-600" dir="ltr">{r.voucher_no}</td>
              <td className="whitespace-nowrap px-3 py-2 text-xs">{formatDate(r.date, locale)}</td>
              <td className="px-3 py-2">{r.kind === "buy" ? <Badge color="green">{t("buyCurrency")}</Badge> : <Badge color="amber">{t("sellCurrency")}</Badge>}</td>
              <td className="whitespace-nowrap px-3 py-2 text-xs font-extrabold" dir="ltr">{formatMoney(r.foreign_amount, r.foreign_currency, locale)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-xs" dir="ltr">{r.rate}</td>
              <td className="whitespace-nowrap px-3 py-2 text-xs font-extrabold" dir="ltr">{formatMoney(r.base_amount, "AFN", locale)}</td>
              <td className={`whitespace-nowrap px-3 py-2 text-xs font-bold ${r.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`} dir="ltr">
                {r.kind === "sell" ? formatMoney(r.profit, "", locale) : "—"}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-xs">{r.customer_name || "—"}</td>
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

      <MultiEntryModal
        open={modal}
        onClose={() => setModal(false)}
        title={defKind === "buy" ? t("buyCurrency") : t("sellCurrency")}
        rows={entry}
        setRows={setEntry}
        blankRow={() => blank(defKind)}
        submitting={submitting}
        onSubmit={submit}
        renderRow={(r, idx, update) => {
          const base = parseNum(r.foreign_amount) * parseNum(r.rate);
          return (
            <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-3 lg:grid-cols-4">
              <Field label={t("type")} required>
                <Segmented
                  value={r.kind}
                  onChange={(v) => update({ kind: v, rate: r.rate || rateFor(r.foreign_currency, v) })}
                  options={[
                    { value: "buy", label: t("buyCurrency") },
                    { value: "sell", label: t("sellCurrency") },
                  ]}
                />
              </Field>
              <Field label={t("date")} required><DateInput value={r.date} onChange={(e) => update({ date: e.target.value })} /></Field>
              <Field label={t("foreignCurrency")} required>
                <CurrencyPicker value={r.foreign_currency} onChange={(v) => update({ foreign_currency: v, rate: rateFor(v, r.kind) })} />
              </Field>
              <Field label={t("foreignAmount")} required><NumInput value={r.foreign_amount} onChange={(v) => update({ foreign_amount: v })} placeholder="0" /></Field>
              <Field label={t("rate")} required><NumInput value={r.rate} onChange={(v) => update({ rate: v })} placeholder="0" /></Field>
              <Field label={t("baseAmount")}>
                <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-extrabold text-emerald-800" dir="ltr">
                  {formatMoney(base, "AFN", locale)}
                </div>
              </Field>
              <Field label={t("foreignSafe")} required><SafePicker value={r.safe_foreign} onChange={(v) => update({ safe_foreign: v })} showBalances /></Field>
              <Field label={t("baseSafe")} required><SafePicker value={r.safe_base} onChange={(v) => update({ safe_base: v })} showBalances /></Field>
              <Field label={t("optionalCustomer")} className="col-span-2"><CustomerPicker value={r.customer_id} onChange={(v) => update({ customer_id: v })} /></Field>
              <Field label={t("note")} className="col-span-2"><TextInput value={r.note} onChange={(e) => update({ note: e.target.value })} /></Field>
            </div>
          );
        }}
      />

      <Confirm open={!!confirm} onClose={() => setConfirm(null)} onYes={doDelete} danger
        message={`${t("confirmDelete")} (${confirm?.voucher})`} />
    </div>
  );
}
