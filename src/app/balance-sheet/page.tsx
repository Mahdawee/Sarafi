"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Download, Scale } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { apiGet } from "@/lib/api";
import { formatNumber, todayISO } from "@/lib/format";
import type { TrialBalanceRow } from "@/lib/types";
import { useData } from "@/components/app-providers";
import { Badge, Btn, DateInput, Empty, Field, PageHeader, SearchBox, Spinner, Tbl } from "@/components/ui";

interface TrialBalanceData {
  to: string;
  rows: TrialBalanceRow[];
  totals: Record<string, { debit: number; credit: number; net: number }>;
}

export default function BalanceSheetPage() {
  const { t, locale } = useLang();
  const { currencies } = useData();
  const [data, setData] = useState<TrialBalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [to, setTo] = useState(todayISO());
  const [currency, setCurrency] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams({ to });
      if (currency) sp.set("currency", currency);
      if (q) sp.set("q", q);
      setData(await apiGet<TrialBalanceData>(`/api/reports/balance-sheet?${sp}`));
    } finally {
      setLoading(false);
    }
  }, [to, currency, q]);

  useEffect(() => {
    const timer = window.setTimeout(load, 180);
    return () => window.clearTimeout(timer);
  }, [load]);

  const downloadCsv = () => {
    if (!data) return;
    const quote = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
    const header = [t("accountType"), t("customerCode"), t("name"), t("currency"), t("debitTotal"), t("creditTotal"), t("balanceSide")];
    const csv = [header, ...data.rows.map((row) => [
      row.account_type === "safe" ? t("accountSafe") : t("accountCustomer"), row.code, row.name,
      row.currency, row.debit, row.credit, row.balance,
    ])].map((r) => r.map(quote).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `trial-balance-${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title={t("trialBalance")}
        sub={t("trialBalanceHint")}
        actions={<Btn variant="secondary" onClick={downloadCsv} disabled={!data || data.rows.length === 0}><Download size={15} /> {t("export")}</Btn>}
      />

      <div className="mb-3 flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <SearchBox value={q} onChange={setQ} className="min-w-48 flex-1" />
        <Field label={t("asOfDate")}><DateInput value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" /></Field>
        <Field label={t("currency")}>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500" dir="ltr">
            <option value="">{t("all")}</option>
            {currencies.map((item) => <option key={item.code} value={item.code}>{item.code}</option>)}
          </select>
        </Field>
      </div>

      {data && Object.keys(data.totals).length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Object.entries(data.totals).map(([cur, total]) => (
            <div key={cur} className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm">
              <Scale className="absolute -end-2 -top-2 h-16 w-16 text-indigo-100" />
              <div className="relative font-extrabold text-indigo-900" dir="ltr">{cur}</div>
              <div className="relative mt-2 grid grid-cols-2 gap-2 text-xs" dir="ltr">
                <span className="text-emerald-700">Dr <b>{formatNumber(total.debit, locale)}</b></span>
                <span className="text-rose-700">Cr <b>{formatNumber(total.credit, locale)}</b></span>
              </div>
              <div className={`relative mt-2 text-sm font-extrabold ${total.net >= 0 ? "text-emerald-700" : "text-rose-700"}`} dir="ltr">{formatNumber(total.net, locale)}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? <Spinner /> : !data || data.rows.length === 0 ? <Empty /> : (
        <Tbl head={[t("accountType"), t("customerCode"), t("name"), t("currency"), t("debitTotal"), t("creditTotal"), t("balanceSide")]}> 
          {data.rows.map((row) => (
            <tr key={`${row.account_type}:${row.account_id}:${row.currency}`} className="hover:bg-indigo-50/30">
              <td className="px-3 py-2"><Badge color={row.account_type === "safe" ? "blue" : "purple"}>{row.account_type === "safe" ? t("accountSafe") : t("accountCustomer")}</Badge></td>
              <td className="px-3 py-2 font-mono text-xs text-slate-500" dir="ltr">{row.code || "—"}</td>
              <td className="whitespace-nowrap px-3 py-2 text-sm font-bold text-slate-700">{row.name}</td>
              <td className="px-3 py-2 text-xs font-bold" dir="ltr">{row.currency}</td>
              <td className="whitespace-nowrap px-3 py-2 text-xs font-bold text-emerald-700" dir="ltr">{formatNumber(row.debit, locale)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-xs font-bold text-rose-700" dir="ltr">{formatNumber(row.credit, locale)}</td>
              <td className={`whitespace-nowrap px-3 py-2 text-xs font-extrabold ${row.balance >= 0 ? "text-emerald-700" : "text-rose-700"}`} dir="ltr">{formatNumber(Math.abs(row.balance), locale)} {row.balance < 0 ? "Cr" : "Dr"}</td>
            </tr>
          ))}
        </Tbl>
      )}
    </div>
  );
}
