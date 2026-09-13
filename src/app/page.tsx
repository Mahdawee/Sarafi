"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight, Banknote, BookOpenCheck, CircleDollarSign, Inbox, Plus, ReceiptText, Send,
  TrendingDown, TrendingUp, Wallet,
} from "lucide-react";
import { useLang } from "@/lib/i18n";
import { apiGet } from "@/lib/api";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import type { DashboardData } from "@/lib/types";
import { Badge, Card, Empty, Spinner } from "@/components/ui";
import { useData } from "@/components/app-providers";

function Stat({ icon, label, value, sub, tone }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; tone: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={`absolute -end-3 -top-3 h-20 w-20 rounded-full opacity-40 ${tone}`} />
      <div className="relative flex items-center gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>{icon}</div>
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-slate-500">{label}</div>
          <div className="mt-0.5 truncate text-lg font-extrabold text-slate-800" dir="auto">{value}</div>
          {sub && <div className="truncate text-[10px] font-medium text-slate-400">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t, locale } = useLang();
  const { customers, balances } = useData();
  const [data, setData] = useState<DashboardData | null>(null);

  const load = useCallback(async () => {
    setData(await apiGet<DashboardData>("/api/dashboard"));
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch(() => {}); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const accountRows = useMemo(() => customers.flatMap((customer) => Object.entries(balances[customer.id] ?? {})
    .filter(([, balance]) => balance.balance !== 0)
    .map(([currency, balance]) => ({ customer, currency, ...balance }))), [customers, balances]);

  if (!data) return <Spinner />;

  const toAfn = (currency: string, value: number) => {
    if (currency === "AFN") return value;
    const rate = data.rates.find((item) => item.code === currency);
    return value * (((rate?.buy_rate ?? 0) + (rate?.sell_rate ?? 0)) / 2 || rate?.buy_rate || rate?.sell_rate || 0);
  };
  const debtorsAfn = accountRows.filter((row) => row.balance < 0).reduce((sum, row) => sum + toAfn(row.currency, -row.balance), 0);
  const creditorsAfn = accountRows.filter((row) => row.balance > 0).reduce((sum, row) => sum + toAfn(row.currency, row.balance), 0);
  const debtors = accountRows.filter((row) => row.balance < 0).sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance)).slice(0, 8);
  const creditors = accountRows.filter((row) => row.balance > 0).sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance)).slice(0, 8);

  const kindLabel: Record<string, string> = { send: t("sendHawala"), receive: t("receiveHawala"), receipt: t("receiptTitle"), exchange: t("nav_exchange"), journal: t("journal") };
  const quick = [
    { href: "/journal", entry: "journal", label: t("journalEntry"), icon: <BookOpenCheck size={15} />, color: "border-cyan-200 bg-cyan-50 text-cyan-800" },
    { href: "/hawala/send", entry: "hawala-send", label: t("newSendHawala"), icon: <Send size={15} />, color: "border-blue-200 bg-blue-50 text-blue-800" },
    { href: "/hawala/receive", entry: "hawala-receive", label: t("newReceiveHawala"), icon: <Inbox size={15} />, color: "border-violet-200 bg-violet-50 text-violet-800" },
    { href: "/exchange", entry: "exchange-buy", label: t("newExchange"), icon: <ArrowLeftRight size={15} />, color: "border-amber-200 bg-amber-50 text-amber-800" },
    { href: "/receipts", entry: "receipt-receive", label: t("newReceipt"), icon: <ReceiptText size={15} />, color: "border-teal-200 bg-teal-50 text-teal-800" },
  ];

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-[#0c4a6e] via-[#0f766e] to-[#11192f] px-5 py-6 text-white shadow-xl shadow-slate-300 sm:px-7">
        <div className="absolute -start-16 -top-20 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute -end-16 -bottom-24 h-64 w-64 rounded-full bg-teal-300/15 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-bold text-cyan-200">{t("appName")}</p>
            <h1 className="text-2xl font-black sm:text-3xl">{t("welcome")}</h1>
            <p className="mt-2 max-w-xl text-xs leading-6 text-slate-200">{locale === "fa" ? "نمای روشن و چندارزی از حساب‌ها، حواله‌ها و نقدینگی امروز شما" : "A live, multi-currency view of today’s accounts, hawala and liquidity."}</p>
          </div>
          <Link href="/balance-sheet" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-white/20"><CircleDollarSign size={17} /> {t("trialBalance")}</Link>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-extrabold text-slate-800">{t("todayStats")}</h2><span className="text-[11px] font-medium text-slate-400">{formatDate(data.today.date, locale)}</span></div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Stat icon={<Send size={20} />} tone="bg-blue-100 text-blue-700" label={`${t("sentToday")} (${locale === "fa" ? data.today.send_count.toLocaleString("fa-AF") : data.today.send_count})`} value={formatMoney(data.today.send_total_afn, "؋", locale)} sub={t("inAfn")} />
          <Stat icon={<Inbox size={20} />} tone="bg-violet-100 text-violet-700" label={`${t("receivedToday")} (${locale === "fa" ? data.today.receive_count.toLocaleString("fa-AF") : data.today.receive_count})`} value={formatMoney(data.today.receive_total_afn, "؋", locale)} sub={t("inAfn")} />
          <Stat icon={<TrendingUp size={20} />} tone="bg-emerald-100 text-emerald-700" label={t("cashInToday")} value={formatMoney(data.today.receipts_in_afn, "؋", locale)} sub={t("inAfn")} />
          <Stat icon={<TrendingDown size={20} />} tone="bg-rose-100 text-rose-700" label={t("cashOutToday")} value={formatMoney(data.today.receipts_out_afn, "؋", locale)} sub={t("inAfn")} />
          <Stat icon={<Wallet size={20} />} tone="bg-amber-100 text-amber-700" label={t("expensesToday")} value={formatMoney(data.today.expenses_afn, "؋", locale)} sub={t("inAfn")} />
          <Stat icon={<Banknote size={20} />} tone="bg-cyan-100 text-cyan-700" label={t("feesToday")} value={formatMoney(data.today.fees_afn, "؋", locale)} sub={t("inAfn")} />
          <Stat icon={<TrendingDown size={20} />} tone="bg-red-100 text-red-700" label={t("totalDebtors")} value={formatMoney(debtorsAfn, "؋", locale)} sub={t("customerDebts")} />
          <Stat icon={<TrendingUp size={20} />} tone="bg-sky-100 text-sky-700" label={t("totalCreditors")} value={formatMoney(creditorsAfn, "؋", locale)} sub={t("customerDebts")} />
        </div>
      </section>

      {Object.keys(data.day_currency_totals).length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
          <div className="mb-3 text-sm font-extrabold text-slate-800">{locale === "fa" ? "گردش امروز به تفکیک ارز" : "Today by currency"}</div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {Object.entries(data.day_currency_totals).map(([currency, total]) => (
              <div key={currency} className="rounded-xl border border-slate-100 bg-slate-50 p-3" dir="ltr">
                <div className="mb-2 flex items-center justify-between"><b className="text-sm text-slate-800">{currency}</b><span className="text-[10px] text-slate-400">{t("today")}</span></div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]"><span className="text-slate-500">Send <b className="text-slate-700">{formatNumber(total.sent, locale)}</b></span><span className="text-slate-500">Receive <b className="text-slate-700">{formatNumber(total.received, locale)}</b></span><span className="text-emerald-700">In <b>{formatNumber(total.cash_in, locale)}</b></span><span className="text-rose-700">Out <b>{formatNumber(total.cash_out, locale)}</b></span></div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-2 text-sm font-extrabold text-slate-800">{t("quickActions")}</div>
        <div className="flex flex-wrap gap-2">{quick.map((item) => <Link key={item.href} href={item.href} onClick={() => window.sessionStorage.setItem("sarafi:quick-entry", item.entry)} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition hover:-translate-y-0.5 hover:shadow-sm ${item.color}`}><Plus size={14} />{item.icon}{item.label}</Link>)}</div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card title={t("safeBalances")}>
          <div className="space-y-2.5">{data.safes.map((safe) => <div key={safe.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="mb-2 flex items-center justify-between"><span className="text-sm font-bold text-slate-700">{safe.name}</span><span className="text-[10px] text-slate-400">{safe.type === "bank" ? t("safeTypeBank") : t("safeTypeCash")}</span></div><div className="flex flex-wrap gap-1.5">{Object.entries(safe.balances).length === 0 ? <span className="text-xs text-slate-400">—</span> : Object.entries(safe.balances).map(([currency, amount]) => <span key={currency} dir="ltr" className={`rounded-lg px-2 py-1 text-xs font-bold tabular-nums ${amount < 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-800"}`}>{currency} {formatNumber(amount, locale)}</span>)}</div></div>)}</div>
        </Card>
        <Card title={t("exchangeRates")} action={<Link href="/settings" className="text-xs font-bold text-cyan-700 hover:underline">{t("edit")}</Link>}>
          <div className="space-y-1.5">{data.rates.filter((rate) => !rate.is_base).map((rate) => <div key={rate.code} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm"><b className="text-slate-700" dir="ltr">{rate.code}</b><span className="flex gap-3 text-[11px]" dir="ltr"><span className="text-emerald-700">{t("buyRate")} <b>{formatNumber(rate.buy_rate, locale, 4)}</b></span><span className="text-rose-700">{t("sellRate")} <b>{formatNumber(rate.sell_rate, locale, 4)}</b></span></span></div>)}</div>
        </Card>
        <Card title={t("recentVouchers")}>
          {data.recent.length === 0 ? <Empty /> : <div className="space-y-1.5">{data.recent.map((item, index) => <div key={`${item.voucher_no}-${index}`} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2"><div className="min-w-0"><div className="truncate text-xs font-bold text-slate-700">{kindLabel[item.type] ?? item.type}</div><div className="truncate text-[10px] text-slate-400" dir="ltr">{item.voucher_no} · {formatDate(item.date, locale)}</div></div><span className="shrink-0 text-xs font-extrabold text-slate-700" dir="ltr">{formatMoney(item.amount, item.currency, locale)}</span></div>)}</div>}
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <AccountList title={t("totalDebtors")} rows={debtors} positive={false} locale={locale} empty={t("noData")} />
        <AccountList title={t("totalCreditors")} rows={creditors} positive locale={locale} empty={t("noData")} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {([ { key: "send", title: `${t("sendHawala")} — ${t("pending")}`, rows: data.pending.send, href: "/hawala/send" }, { key: "receive", title: `${t("receiveHawala")} — ${t("pending")}`, rows: data.pending.receive, href: "/hawala/receive" } ] as const).map((group) => <Card key={group.key} title={group.title} action={<Link href={group.href} className="text-xs font-bold text-cyan-700 hover:underline">{t("all")}</Link>}>{group.rows.length === 0 ? <Empty /> : <div className="space-y-1.5">{group.rows.slice(0, 6).map((hawala) => <div key={hawala.id} className="flex items-center justify-between gap-2 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2"><div className="min-w-0"><div className="truncate text-xs font-bold text-slate-700">{hawala.sender_name} ← {hawala.receiver_name}</div><div className="text-[10px] text-slate-400" dir="ltr">{hawala.voucher_no} · {formatDate(hawala.date, locale)}</div></div><div className="flex shrink-0 items-center gap-2"><span className="text-xs font-extrabold text-slate-700" dir="ltr">{formatMoney(hawala.amount, hawala.currency, locale)}</span><Badge color="amber">{t("pending")}</Badge></div></div>)}</div>}</Card>)}
      </section>
    </div>
  );
}

function AccountList({ title, rows, positive, locale, empty }: {
  title: string;
  rows: { customer: { id: number; name: string; code: string }; currency: string; balance: number }[];
  positive: boolean;
  locale: "fa" | "en";
  empty: string;
}) {
  return <Card title={title} action={<Link href="/customers" className="text-xs font-bold text-cyan-700 hover:underline">{locale === "fa" ? "مشاهده همه" : "View all"}</Link>}>{rows.length === 0 ? <Empty text={empty} /> : <div className="space-y-1.5">{rows.map((row) => <Link key={`${row.customer.id}-${row.currency}`} href={`/customers/${row.customer.id}`} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 transition hover:bg-slate-100"><div className="min-w-0"><div className="truncate text-xs font-bold text-slate-700">{row.customer.name}</div><div className="text-[10px] text-slate-400" dir="ltr">{row.customer.code}</div></div><span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-extrabold ${positive ? "bg-blue-100 text-blue-800" : "bg-rose-100 text-rose-700"}`} dir="ltr">{row.currency} {formatNumber(Math.abs(row.balance), locale)}</span></Link>)}</div>}</Card>;
}
