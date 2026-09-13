"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight, Banknote, Inbox, Plus, ReceiptText, Send, TrendingDown, TrendingUp, Wallet,
} from "lucide-react";
import { useLang } from "@/lib/i18n";
import { apiGet } from "@/lib/api";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import type { DashboardData } from "@/lib/types";
import { Badge, Card, Empty, PageHeader, Spinner } from "@/components/ui";
import { useData } from "@/components/app-providers";

function Stat({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${color}`}>{icon}</div>
      <div className="min-w-0">
        <div className="truncate text-xs text-slate-500">{label}</div>
        <div className="truncate text-lg font-extrabold text-slate-800" dir="auto">{value}</div>
        {sub && <div className="truncate text-[11px] text-slate-400">{sub}</div>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t, locale } = useLang();
  const { refresh } = useData();
  const [data, setData] = useState<DashboardData | null>(null);

  const load = async () => {
    const d = await apiGet<DashboardData>("/api/dashboard");
    setData(d);
    refresh();
  };
  useEffect(() => {
    load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) return <Spinner />;

  const debtorsAfn = Object.entries(data.customerTotals).reduce((s, [cur, v]) => {
    const bal = (v.credit ?? 0) - (v.debit ?? 0);
    return s + (bal < 0 ? -bal : 0);
  }, 0);
  const creditorsAfn = Object.entries(data.customerTotals).reduce((s, [cur, v]) => {
    const bal = (v.credit ?? 0) - (v.debit ?? 0);
    return s + (bal > 0 ? bal : 0);
  }, 0);

  const typeLabel: Record<string, string> = {
    send: t("sendHawala"), receive: t("receiveHawala"), receipt: t("receiptTitle"), exchange: t("nav_exchange"),
  };

  return (
    <div>
      <PageHeader title={t("nav_dashboard")} sub={t("welcome")} />

      {/* Today stats */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat icon={<Send size={20} />} color="bg-blue-100 text-blue-700" label={`${t("sentToday")} (${locale === "fa" ? data.today.send_count.toLocaleString("fa-AF") : data.today.send_count})`} value={`${formatMoney(data.today.send_total_afn, "", locale)} ؋`} sub={t("inAfn")} />
        <Stat icon={<Inbox size={20} />} color="bg-violet-100 text-violet-700" label={`${t("receivedToday")} (${locale === "fa" ? data.today.receive_count.toLocaleString("fa-AF") : data.today.receive_count})`} value={`${formatMoney(data.today.receive_total_afn, "", locale)} ؋`} sub={t("inAfn")} />
        <Stat icon={<TrendingUp size={20} />} color="bg-emerald-100 text-emerald-700" label={t("cashInToday")} value={`${formatMoney(data.today.receipts_in_afn, "", locale)} ؋`} sub={t("inAfn")} />
        <Stat icon={<TrendingDown size={20} />} color="bg-rose-100 text-rose-700" label={t("cashOutToday")} value={`${formatMoney(data.today.receipts_out_afn, "", locale)} ؋`} sub={t("inAfn")} />
        <Stat icon={<Wallet size={20} />} color="bg-amber-100 text-amber-700" label={t("expensesToday")} value={`${formatMoney(data.today.expenses_afn, "", locale)} ؋`} sub={t("inAfn")} />
        <Stat icon={<Banknote size={20} />} color="bg-teal-100 text-teal-700" label={t("feesToday")} value={`${formatMoney(data.today.fees_afn, "", locale)} ؋`} sub={t("inAfn")} />
        <Stat icon={<TrendingDown size={20} />} color="bg-red-100 text-red-700" label={t("totalDebtors")} value={formatNumber(debtorsAfn, locale, 0)} sub={t("customerDebts")} />
        <Stat icon={<TrendingUp size={20} />} color="bg-sky-100 text-sky-700" label={t("totalCreditors")} value={formatNumber(creditorsAfn, locale, 0)} sub={t("customerDebts")} />
      </div>

      {/* Quick actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        {[
          { href: "/hawala/send", label: t("newSendHawala"), icon: <Send size={15} /> },
          { href: "/hawala/receive", label: t("newReceiveHawala"), icon: <Inbox size={15} /> },
          { href: "/receipts", label: t("newReceipt"), icon: <ReceiptText size={15} /> },
          { href: "/exchange", label: t("newExchange"), icon: <ArrowLeftRight size={15} /> },
        ].map((a) => (
          <Link key={a.href} href={a.href} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            <Plus size={14} /> {a.icon} {a.label}
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {/* Safe balances */}
        <Card title={t("safeBalances")}>
          <div className="space-y-3">
            {data.safes.map((s) => (
              <div key={s.id} className="rounded-xl bg-slate-50 p-3">
                <div className="mb-1.5 text-sm font-bold text-slate-700">{s.name}</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(s.balances).length === 0 && <span className="text-xs text-slate-400">—</span>}
                  {Object.entries(s.balances).map(([cur, bal]) => (
                    <span key={cur} dir="ltr" className={`rounded-lg px-2 py-1 text-xs font-bold tabular-nums ${bal < 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-800"}`}>
                      {cur} {formatNumber(bal, locale)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Rates */}
        <Card title={t("exchangeRates")} action={<Link href="/settings" className="text-xs font-bold text-emerald-600 hover:underline">{t("edit")}</Link>}>
          <div className="space-y-1.5">
            {data.rates.filter((r) => !r.is_base).map((r) => (
              <div key={r.code} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <span className="font-extrabold text-slate-700" dir="ltr">{r.code}</span>
                <span className="flex gap-3 text-xs" dir="ltr">
                  <span className="text-slate-500">{t("buyRate")}: <b className="text-emerald-700">{formatNumber(r.buy_rate, locale, 4)}</b></span>
                  <span className="text-slate-500">{t("sellRate")}: <b className="text-rose-600">{formatNumber(r.sell_rate, locale, 4)}</b></span>
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent */}
        <Card title={t("recentVouchers")}>
          {data.recent.length === 0 ? <Empty /> : (
            <div className="space-y-1.5">
              {data.recent.map((r, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-bold text-slate-700">{typeLabel[r.type] ?? r.type}</div>
                    <div className="truncate text-[11px] text-slate-400" dir="ltr">{r.voucher_no} • {formatDate(r.date, locale)}</div>
                  </div>
                  <span className="shrink-0 text-xs font-extrabold text-slate-700" dir="ltr">{formatMoney(r.amount, r.currency, locale)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Pending hawala */}
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {(
          [
            { key: "send", title: `${t("sendHawala")} — ${t("pending")}`, rows: data.pending.send, href: "/hawala/send" },
            { key: "receive", title: `${t("receiveHawala")} — ${t("pending")}`, rows: data.pending.receive, href: "/hawala/receive" },
          ] as const
        ).map((g) => (
          <Card key={g.key} title={g.title} action={<Link href={g.href} className="text-xs font-bold text-emerald-600 hover:underline">{t("all")}</Link>}>
            {g.rows.length === 0 ? <Empty /> : (
              <div className="space-y-1.5">
                {g.rows.slice(0, 6).map((h) => (
                  <div key={h.id} className="flex items-center justify-between gap-2 rounded-xl bg-amber-50/60 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-bold text-slate-700">{h.sender_name} ← {h.receiver_name}</div>
                      <div className="text-[11px] text-slate-400" dir="ltr">{h.voucher_no} • {formatDate(h.date, locale)}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs font-extrabold text-slate-700" dir="ltr">{formatMoney(h.amount, h.currency, locale)}</span>
                      <Badge color="amber">{t("pending")}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
