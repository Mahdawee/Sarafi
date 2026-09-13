"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight, Banknote, BookOpenText, Home, Landmark, LayoutDashboard,
  Menu, ReceiptText, Send, Inbox, Settings, Users, Wallet, X, Languages,
} from "lucide-react";
import { useLang, type DictKey } from "@/lib/i18n";
import { useData } from "./app-providers";

const NAV: { href: string; key: DictKey; icon: React.ReactNode }[] = [
  { href: "/", key: "nav_dashboard", icon: <LayoutDashboard size={19} /> },
  { href: "/hawala/send", key: "nav_hawala_send", icon: <Send size={19} /> },
  { href: "/hawala/receive", key: "nav_hawala_receive", icon: <Inbox size={19} /> },
  { href: "/receipts", key: "nav_receipts", icon: <ReceiptText size={19} /> },
  { href: "/debit-credit", key: "nav_debit_credit", icon: <BookOpenText size={19} /> },
  { href: "/exchange", key: "nav_exchange", icon: <ArrowLeftRight size={19} /> },
  { href: "/customers", key: "nav_customers", icon: <Users size={19} /> },
  { href: "/safes", key: "nav_safes", icon: <Landmark size={19} /> },
  { href: "/expenses", key: "nav_expenses", icon: <Wallet size={19} /> },
  { href: "/reports", key: "nav_reports", icon: <Banknote size={19} /> },
  { href: "/settings", key: "nav_settings", icon: <Settings size={19} /> },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const { t, locale, setLocale } = useLang();
  const { settings } = useData();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const company = locale === "fa" ? settings.company_fa || "صرافی" : settings.company_en || "Sarafi";

  const nav = (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.map((n) => {
        const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              active
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-900/40"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            {n.icon}
            <span>{t(n.key)}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div id="app-root" className="min-h-screen bg-slate-100">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 z-40 hidden w-60 flex-col bg-slate-900 lg:flex start-0">
        <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-xl font-black text-white">
            {locale === "fa" ? "ص" : "S"}
          </div>
          <div>
            <div className="text-sm font-extrabold text-white">{company}</div>
            <div className="text-[11px] text-slate-400">{t("appName")}</div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <div className="border-t border-white/10 p-3">
          <button
            onClick={() => setLocale(locale === "fa" ? "en" : "fa")}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/20"
          >
            <Languages size={15} /> {locale === "fa" ? "English" : "دری"}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 flex w-64 flex-col bg-slate-900 start-0">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <span className="text-sm font-extrabold text-white">{company}</span>
              <button onClick={() => setOpen(false)} className="cursor-pointer rounded-lg p-1.5 text-slate-300 hover:bg-white/10">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{nav}</div>
            <div className="border-t border-white/10 p-3">
              <button
                onClick={() => setLocale(locale === "fa" ? "en" : "fa")}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-slate-200"
              >
                <Languages size={15} /> {locale === "fa" ? "English" : "دری"}
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="lg:ps-60">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <button onClick={() => setOpen(true)} className="cursor-pointer rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden">
              <Menu size={20} />
            </button>
            <div className="text-sm font-extrabold text-slate-800 lg:hidden">{company}</div>
            <div className="hidden text-xs text-slate-400 lg:block">
              {locale === "fa" ? settings.address_fa : settings.address_en}
              {settings.phone ? ` • ${settings.phone}` : ""}
            </div>
            <button
              onClick={() => setLocale(locale === "fa" ? "en" : "fa")}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 lg:hidden"
            >
              <Languages size={14} /> {locale === "fa" ? "EN" : "دری"}
            </button>
            <div className="hidden items-center gap-2 lg:flex">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                {new Date().toLocaleDateString(locale === "fa" ? "fa-AF" : "en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </span>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-3 sm:p-5">{children}</main>
      </div>
    </div>
  );
}
