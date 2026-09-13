"use client";

import React, { use, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { apiGet } from "@/lib/api";
import { formatDate, formatNumber, todayISO } from "@/lib/format";
import type { CustomerStatement } from "@/lib/types";
import { Badge, Btn, DateInput, Empty, PageHeader, Select, Spinner, Tbl } from "@/components/ui";
import { useData } from "@/components/app-providers";

const REF_LABEL: Record<string, Record<string, string>> = {
  hawala_send: { fa: "حواله ارسالی", en: "Sent hawala" },
  hawala_receive: { fa: "حواله دریافتی", en: "Received hawala" },
  hawala_cancel: { fa: "لغو حواله", en: "Hawala reversal" },
  receipt: { fa: "رسید", en: "Receipt" },
  debit_credit: { fa: "دبت/کردت", en: "Debit/Credit" },
  exchange: { fa: "ارز", en: "Exchange" },
  journal: { fa: "روزنامه", en: "Journal" },
};

export default function StatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, locale } = useLang();
  const { currencies, settings } = useData();
  const [data, setData] = useState<CustomerStatement & { opening: Record<string, number> } | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(todayISO());
  const [currency, setCurrency] = useState("");
  const [printing, setPrinting] = useState(false);

  const load = useCallback(async () => {
    const sp = new URLSearchParams();
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    if (currency) sp.set("currency", currency);
    const d = await apiGet<CustomerStatement & { opening: Record<string, number> }>(`/api/customers/${id}/statement?${sp}`);
    setData(d);
  }, [id, from, to, currency]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch(() => {}); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const entriesWithRunning = useMemo(() => {
    if (!data || !currency) return data?.entries.map((entry) => ({ ...entry, running: 0 })) ?? [];
    let running = data.opening[currency] ?? 0;
    return data.entries.map((entry) => {
      running += entry.credit - entry.debit;
      return { ...entry, running };
    });
  }, [data, currency]);

  if (!data) return <Spinner />;

  const showRunning = !!currency;
  const printStatement = () => {
    setPrinting(true);
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => setPrinting(false), 400);
    }, 120);
  };

  return (
    <div>
      <PageHeader
        title={`${t("statement")} — ${data.customer.name}`}
        sub={`${data.customer.code} • ${data.customer.phone}`}
        actions={
          <>
            <Link href="/customers" className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200">
              <ArrowLeft size={15} className="rtl:rotate-180" /> {t("nav_customers")}
            </Link>
            <Btn variant="secondary" onClick={printStatement}><Printer size={15} /> {t("print")}</Btn>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
        <DateInput value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
        <DateInput value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
        <Select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-auto">
          <option value="">{t("currency")}: {t("all")}</option>
          {currencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
        </Select>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {Object.entries(data.totals).map(([cur, v]) => (
          <div key={cur} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs shadow-sm" dir="ltr">
            <b>{cur}</b>
            <span>{t("debit")}: <b className="text-rose-600">{formatNumber(v.debit, locale)}</b></span>
            <span>{t("credit")}: <b className="text-emerald-600">{formatNumber(v.credit, locale)}</b></span>
            <span>{t("balance")}: <b className={v.balance >= 0 ? "text-blue-700" : "text-rose-700"}>{formatNumber(v.balance, locale)}</b>
              <span className="ms-1 text-[10px] text-slate-400">({v.balance > 0 ? t("creditor") : v.balance < 0 ? t("debtor") : t("settled")})</span>
            </span>
          </div>
        ))}
      </div>

      {data.entries.length === 0 ? <Empty /> : (
        <Tbl head={[t("date"), t("voucherNo"), t("type"), t("description"), t("currency"), t("debit"), t("credit"), showRunning ? t("balance") : ""]}>
          {showRunning && (data.opening[currency] ?? 0) !== 0 && (
            <tr className="bg-slate-50">
              <td colSpan={7} className="px-3 py-2 text-xs font-bold">{t("openingBalance")}</td>
              <td className="px-3 py-2 text-xs font-extrabold" dir="ltr">{formatNumber(data.opening[currency], locale)}</td>
            </tr>
          )}
          {entriesWithRunning.map((e) => {
            return (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-3 py-2 text-xs">{formatDate(e.date, locale)}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs" dir="ltr">{e.voucher_no}</td>
                <td className="px-3 py-2"><Badge color="gray">{REF_LABEL[e.ref_type]?.[locale] ?? e.ref_type}</Badge></td>
                <td className="max-w-64 truncate px-3 py-2 text-xs">{e.description}</td>
                <td className="px-3 py-2 text-xs font-bold" dir="ltr">{e.currency}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-rose-600" dir="ltr">{e.debit ? formatNumber(e.debit, locale) : "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-emerald-600" dir="ltr">{e.credit ? formatNumber(e.credit, locale) : "—"}</td>
                {showRunning && <td className="whitespace-nowrap px-3 py-2 text-xs font-extrabold" dir="ltr">{formatNumber(e.running, locale)}</td>}
              </tr>
            );
          })}
        </Tbl>
      )}

      {printing && createPortal(
        <div id="print-root" dir={locale === "fa" ? "rtl" : "ltr"}>
          <div className="print-doc">
            <div className="print-head"><h1>{locale === "fa" ? settings.company_fa : settings.company_en}</h1><p>{t("statement")} — {data.customer.name}</p></div>
            <div className="print-meta"><span>{t("customerCode")}: <b dir="ltr">{data.customer.code}</b></span><span>{t("phone")}: <b dir="ltr">{data.customer.phone}</b></span></div>
            <table className="print-table"><thead><tr><th>{t("date")}</th><th>{t("voucherNo")}</th><th>{t("description")}</th><th>{t("currency")}</th><th>{t("debit")}</th><th>{t("credit")}</th>{showRunning && <th>{t("balance")}</th>}</tr></thead><tbody>
              {showRunning && (data.opening[currency] ?? 0) !== 0 && <tr><td colSpan={6}>{t("openingBalance")}</td><td>{formatNumber(data.opening[currency], locale)}</td></tr>}
              {entriesWithRunning.map((entry) => <tr key={entry.id}><td>{formatDate(entry.date, locale)}</td><td dir="ltr">{entry.voucher_no}</td><td>{entry.description}</td><td dir="ltr">{entry.currency}</td><td>{entry.debit ? formatNumber(entry.debit, locale) : ""}</td><td>{entry.credit ? formatNumber(entry.credit, locale) : ""}</td>{showRunning && <td>{formatNumber(entry.running, locale)}</td>}</tr>)}
            </tbody></table>
          </div>
        </div>, document.body
      )}
    </div>
  );
}
