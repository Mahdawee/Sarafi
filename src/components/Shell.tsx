"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight, BookOpenCheck, BookOpenText, ChevronDown, CircleDollarSign,
  FileBarChart, Home, Inbox, Landmark, Languages, Menu, Plus, ReceiptText, Send,
  Settings, Users, Wallet, X,
} from "lucide-react";
import { useLang, type DictKey } from "@/lib/i18n";
import { useData } from "./app-providers";
import { Modal } from "./ui";

type NavItem = { href: string; key: DictKey; icon: React.ReactNode };
type NavGroup = { key: DictKey; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    key: "nav_group_operations",
    items: [
      { href: "/journal", key: "nav_journal", icon: <BookOpenCheck size={17} /> },
      { href: "/receipts", key: "nav_receipts", icon: <ReceiptText size={17} /> },
      { href: "/debit-credit", key: "nav_debit_credit", icon: <BookOpenText size={17} /> },
      { href: "/exchange", key: "nav_exchange", icon: <ArrowLeftRight size={17} /> },
      { href: "/expenses", key: "nav_expenses", icon: <Wallet size={17} /> },
    ],
  },
  {
    key: "nav_group_hawala",
    items: [
      { href: "/hawala/send", key: "nav_hawala_send", icon: <Send size={17} /> },
      { href: "/hawala/receive", key: "nav_hawala_receive", icon: <Inbox size={17} /> },
    ],
  },
  {
    key: "nav_group_accounts",
    items: [
      { href: "/customers", key: "nav_customers", icon: <Users size={17} /> },
      { href: "/safes", key: "nav_safes", icon: <Landmark size={17} /> },
    ],
  },
  {
    key: "nav_group_finance",
    items: [
      { href: "/balance-sheet", key: "nav_balance_sheet", icon: <CircleDollarSign size={17} /> },
      { href: "/reports", key: "nav_reports", icon: <FileBarChart size={17} /> },
    ],
  },
  {
    key: "nav_group_system",
    items: [{ href: "/settings", key: "nav_settings", icon: <Settings size={17} /> }],
  },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const { t, locale, setLocale } = useLang();
  const { settings } = useData();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const company = locale === "fa" ? settings.company_fa || "صرافی" : settings.company_en || "Sarafi";

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 px-4 py-4">
        <Link href="/" onClick={() => setDrawerOpen(false)} className="flex items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-teal-300">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-teal-500 text-xl font-black text-slate-950 shadow-lg shadow-cyan-950/30">
            {locale === "fa" ? "ص" : "S"}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold text-white">{company}</div>
            <div className="text-[10px] font-semibold tracking-[0.12em] text-slate-400 uppercase">{t("appName")}</div>
          </div>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <Link
          href="/"
          onClick={() => setDrawerOpen(false)}
          className={`mb-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${isActive(pathname, "/") ? "bg-teal-500 text-slate-950 shadow-lg shadow-teal-950/30" : "text-slate-300 hover:bg-white/8 hover:text-white"}`}
        >
          <Home size={18} /> {t("nav_dashboard")}
        </Link>

        {NAV_GROUPS.map((group) => {
          const open = expanded[group.key] ?? true;
          const groupHasActive = group.items.some((item) => isActive(pathname, item.href));
          return (
            <section key={group.key} className="mb-1">
              <button
                onClick={() => setExpanded((old) => ({ ...old, [group.key]: !open }))}
                className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-[11px] font-extrabold tracking-wide transition ${groupHasActive ? "text-cyan-300" : "text-slate-500 hover:text-slate-300"}`}
              >
                <span>{t(group.key)}</span>
                <ChevronDown size={14} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
              </button>
              {open && (
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setDrawerOpen(false)}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition ${active ? "bg-white text-slate-900 shadow-sm" : "text-slate-300 hover:bg-white/8 hover:text-white"}`}
                      >
                        <span className={active ? "text-teal-600" : "text-slate-400"}>{item.icon}</span>
                        <span>{t(item.key)}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <div className="border-t border-white/10 p-3">
        <button
          onClick={() => setLocale(locale === "fa" ? "en" : "fa")}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10"
        >
          <Languages size={15} /> {locale === "fa" ? "English" : "دری"}
        </button>
      </div>
    </div>
  );

  return (
    <div id="app-root" className="min-h-screen bg-[#f4f7fb]">
      <aside className="fixed inset-y-0 z-40 hidden w-64 border-e border-white/10 bg-[#11192f] lg:flex start-0">
        {sidebar}
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label={t("close")} className="absolute inset-0 cursor-default bg-slate-950/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 flex w-72 border-e border-white/10 bg-[#11192f] shadow-2xl start-0">
            <button onClick={() => setDrawerOpen(false)} className="absolute end-3 top-3 z-10 cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"><X size={18} /></button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:ps-64">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 shadow-sm shadow-slate-200/30 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-3 px-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-2">
              <button onClick={() => setDrawerOpen(true)} className="cursor-pointer rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden"><Menu size={21} /></button>
              <div className="hidden text-xs font-semibold text-slate-400 sm:block">{locale === "fa" ? settings.address_fa : settings.address_en}</div>
              <div className="truncate text-sm font-extrabold text-slate-800 sm:hidden">{company}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-500 xl:inline">
                {new Date().toLocaleDateString(locale === "fa" ? "fa-AF" : "en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </span>
              <button onClick={() => setQuickOpen(true)} className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-l from-teal-500 to-cyan-500 px-3 py-2 text-xs font-extrabold text-slate-950 shadow-sm shadow-cyan-200 transition hover:brightness-95"><Plus size={16} /> {t("quickEntry")}</button>
              <button onClick={() => setLocale(locale === "fa" ? "en" : "fa")} className="cursor-pointer rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 lg:hidden"><Languages size={15} /></button>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] p-3 sm:p-5">{children}</main>
      </div>

      <QuickEntry open={quickOpen} onClose={() => setQuickOpen(false)} />
    </div>
  );
}

function QuickEntry({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, locale } = useLang();
  const router = useRouter();
  const launch = (href: string, entry: string) => {
    sessionStorage.setItem("sarafi:quick-entry", entry);
    onClose();
    router.push(href);
  };
  const actions = [
    { label: t("journalEntry"), href: "/journal", entry: "journal", icon: <BookOpenCheck size={16} />, color: "border-cyan-400 text-cyan-200 hover:bg-cyan-400/10" },
    { label: t("newReceipt"), href: "/receipts", entry: "receipt-receive", icon: <ReceiptText size={16} />, color: "border-sky-400 text-sky-200 hover:bg-sky-400/10" },
    { label: t("buyCurrency"), href: "/exchange", entry: "exchange-buy", icon: <ArrowLeftRight size={16} />, color: "border-blue-400 text-blue-200 hover:bg-blue-400/10" },
    { label: t("newTransfer"), href: "/safes", entry: "transfer", icon: <Landmark size={16} />, color: "border-violet-400 text-violet-200 hover:bg-violet-400/10" },
    { label: t("newExpense"), href: "/expenses", entry: "expense", icon: <Wallet size={16} />, color: "border-teal-400 text-teal-200 hover:bg-teal-400/10" },
    { label: t("newSendHawala"), href: "/hawala/send", entry: "hawala-send", icon: <Send size={16} />, color: "border-rose-400 text-rose-200 hover:bg-rose-400/10" },
    { label: t("newReceiveHawala"), href: "/hawala/receive", entry: "hawala-receive", icon: <Inbox size={16} />, color: "border-amber-400 text-amber-200 hover:bg-amber-400/10" },
  ];
  return (
    <Modal open={open} onClose={onClose} title={t("quickEntry")}>
      <div className="-m-5 min-h-72 bg-[#11192f] p-6">
        <p className="mb-5 text-center text-xs font-semibold text-slate-400">{t("quickEntryHint")}</p>
        <div className="space-y-3">
          {actions.map((action) => <button key={action.entry} onClick={() => launch(action.href, action.entry)} className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold transition ${action.color}`}>{action.icon}{action.label}</button>)}
        </div>
        <p className="mt-5 text-center text-[10px] text-slate-500">{locale === "fa" ? "پس از انتخاب، فرم ورود همان معامله باز می‌شود." : "The selected transaction form opens immediately."}</p>
      </div>
    </Modal>
  );
}
