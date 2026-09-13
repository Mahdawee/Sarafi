"use client";

import React, { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { apiGet } from "@/lib/api";
import { formatDate, formatMoney, formatNumber, todayISO } from "@/lib/format";
import type { ProfitReport } from "@/lib/types";
import { Btn, Card, DateInput, Empty, PageHeader, Segmented, Spinner, Tbl } from "@/components/ui";

interface DailyData {
  date: string;
  sends: Record<string, unknown>[];
  receives: Record<string, unknown>[];
  receipts: Record<string, unknown>[];
  dc: Record<string, unknown>[];
  exchanges: Record<string, unknown>[];
  expenses: Record<string, unknown>[];
  transfers: Record<string, unknown>[];
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));

export default function ReportsPage() {
  const { t, locale } = useLang();
  const [tab, setTab] = useState<"profit" | "daily">("profit");
  const [from, setFrom] = useState(todayISO().slice(0, 8) + "01");
  const [to, setTo] = useState(todayISO());
  const [day, setDay] = useState(todayISO());
  const [profit, setProfit] = useState<ProfitReport | null>(null);
  const [daily, setDaily] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(false);

  const loadProfit = async () => {
    setLoading(true);
    try {
      setProfit(await apiGet<ProfitReport>(`/api/reports/profit?from=${from}&to=${to}`));
    } finally {
      setLoading(false);
    }
  };
  const loadDaily = async () => {
    setLoading(true);
    try {
      setDaily(await apiGet<DailyData>(`/api/reports/daily?date=${day}`));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "profit") loadProfit();
    else loadDaily();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const dailySections: { key: keyof Omit<DailyData, "date">; title: string }[] = [
    { key: "sends", title: t("nav_hawala_send") },
    { key: "receives", title: t("nav_hawala_receive") },
    { key: "receipts", title: t("nav_receipts") },
    { key: "dc", title: t("nav_debit_credit") },
    { key: "exchanges", title: t("nav_exchange") },
    { key: "expenses", title: t("nav_expenses") },
    { key: "transfers", title: t("transfer") },
  ];

  return (
    <div>
      <PageHeader
        title={t("nav_reports")}
        actions={
          <>
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: "profit", label: t("profitReport") },
                { value: "daily", label: t("dailyReport") },
              ]}
            />
            <Btn variant="secondary" onClick={() => window.print()}><Printer size={15} /> {t("print")}</Btn>
          </>
        }
      />

      {tab === "profit" && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
            <DateInput value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
            <DateInput value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
            <Btn onClick={loadProfit}>{t("showReport")}</Btn>
          </div>
          {loading ? <Spinner /> : !profit ? <Empty /> : (
            <>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <ProfitCard label={t("totalFees")} value={profit.hawala_fees} color="bg-emerald-100 text-emerald-800" locale={locale} />
                <ProfitCard label={t("totalExchangeProfit")} value={profit.exchange_profit} color="bg-blue-100 text-blue-800" locale={locale} />
                <ProfitCard label={t("totalExpenses")} value={-profit.expenses} color="bg-rose-100 text-rose-700" locale={locale} negative />
                <ProfitCard label={t("netProfit")} value={profit.net} color={profit.net >= 0 ? "bg-teal-600 text-white" : "bg-rose-600 text-white"} locale={locale} big />
              </div>
              <Card title={`${t("dateRange")}: ${formatDate(profit.from, locale)} — ${formatDate(profit.to, locale)}`} className="mt-4">
                <Tbl head={[t("currency"), t("totalFees"), t("totalExchangeProfit"), t("totalExpenses")]}>
                  {Object.entries(profit.by_currency).map(([cur, v]) => (
                    <tr key={cur}>
                      <td className="px-3 py-2 font-extrabold" dir="ltr">{cur}</td>
                      <td className="px-3 py-2 text-emerald-700" dir="ltr">{formatNumber(v.fees, locale)}</td>
                      <td className="px-3 py-2 text-blue-700" dir="ltr">{formatNumber(v.exchange, locale)}</td>
                      <td className="px-3 py-2 text-rose-600" dir="ltr">{formatNumber(v.expenses, locale)}</td>
                    </tr>
                  ))}
                </Tbl>
                <p className="mt-2 text-[11px] text-slate-400">{t("inAfn")}: {t("totalFees")} {formatMoney(profit.hawala_fees, "؋", locale)} • {t("totalExpenses")} {formatMoney(profit.expenses, "؋", locale)}</p>
              </Card>
            </>
          )}
        </>
      )}

      {tab === "daily" && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
            <DateInput value={day} onChange={(e) => setDay(e.target.value)} className="w-auto" />
            <Btn onClick={loadDaily}>{t("showReport")}</Btn>
          </div>
          {loading ? <Spinner /> : !daily ? <Empty /> : (
            <div className="space-y-4">
              {dailySections.map((s) => {
                const rows = daily[s.key];
                if (rows.length === 0) return null;
                return (
                  <Card key={s.key} title={`${s.title} (${locale === "fa" ? rows.length.toLocaleString("fa-AF") : rows.length})`}>
                    <Tbl head={[t("voucherNo"), t("description"), t("amount")]}>
                      {rows.map((r, i) => (
                        <tr key={i}>
                          <td className="whitespace-nowrap px-3 py-2 font-mono text-xs" dir="ltr">{str(r.voucher_no)}</td>
                          <td className="px-3 py-2 text-xs">
                            {[str(r.sender_name), str(r.receiver_name), str(r.customer_name), str(r.description), str(r.reason), str(r.note), str(r.category)].filter(Boolean).join(" • ") || "—"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-xs font-extrabold" dir="ltr">
                            {s.key === "exchanges"
                              ? `${formatMoney(num(r.foreign_amount), str(r.foreign_currency), locale)} = ${formatMoney(num(r.base_amount), "AFN", locale)}`
                              : formatMoney(num(r.amount), str(r.currency), locale)}
                          </td>
                        </tr>
                      ))}
                    </Tbl>
                  </Card>
                );
              })}
              {dailySections.every((s) => daily[s.key].length === 0) && <Empty />}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ProfitCard({ label, value, color, locale, big, negative }: {
  label: string; value: number; color: string; locale: "fa" | "en"; big?: boolean; negative?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-4 shadow-sm ${color}`}>
      <div className={`text-xs ${big ? "opacity-90" : "opacity-70"}`}>{label}</div>
      <div className={`font-extrabold tabular-nums ${big ? "text-2xl" : "text-xl"}`} dir="ltr">
        {negative ? "−" : ""}{formatNumber(Math.abs(value), locale)} <span className="text-xs">؋</span>
      </div>
    </div>
  );
}
