"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import { LanguageProvider } from "@/lib/i18n";
import type { Customer, Safe, CurrencyRate } from "@/lib/types";

// ── Toast ──
interface Toast { id: number; msg: string; kind: "success" | "error" | "info" }
const ToastCtx = createContext<{ toast: (msg: string, kind?: Toast["kind"]) => void }>({ toast: () => {} });
export const useToast = () => useContext(ToastCtx);

function ToastHost({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto rounded-xl px-5 py-3 text-sm font-medium text-white shadow-xl ${
            t.kind === "success" ? "bg-emerald-600" : t.kind === "error" ? "bg-rose-600" : "bg-slate-800"
          }`}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ── Shared data (customers, safes, currencies, settings) ──
interface Bal { debit: number; credit: number; balance: number }
interface DataCtx {
  customers: Customer[];
  balances: Record<number, Record<string, Bal>>;
  safes: Safe[];
  safeBalances: Record<number, Record<string, number>>;
  currencies: CurrencyRate[];
  settings: Record<string, string>;
  loading: boolean;
  refresh: () => Promise<void>;
  customerName: (id: number) => string;
  safeName: (id: number) => string;
}

const Ctx = createContext<DataCtx>({
  customers: [], balances: {}, safes: [], safeBalances: {}, currencies: [], settings: {},
  loading: true, refresh: async () => {}, customerName: () => "", safeName: () => "",
});
export const useData = () => useContext(Ctx);

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [balances, setBalances] = useState<DataCtx["balances"]>({});
  const [safes, setSafes] = useState<Safe[]>([]);
  const [safeBalances, setSafeBalances] = useState<DataCtx["safeBalances"]>({});
  const [currencies, setCurrencies] = useState<CurrencyRate[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const toast = useCallback((msg: string, kind: Toast["kind"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((p) => [...p, { id, msg, kind }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3200);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [c, s, cur, st] = await Promise.all([
        apiGet<{ customers: Customer[]; balances: DataCtx["balances"] }>("/api/customers"),
        apiGet<{ safes: Safe[]; balances: Record<number, Record<string, number>> }>("/api/safes"),
        apiGet<{ currencies: CurrencyRate[] }>("/api/currencies"),
        apiGet<{ settings: Record<string, string> }>("/api/settings"),
      ]);
      setCustomers(c.customers);
      setBalances(c.balances);
      setSafes(s.safes);
      setSafeBalances(s.balances);
      setCurrencies(cur.currencies);
      setSettings(st.settings);
    } catch {
      // ignore, pages handle their own errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const customerMap = useMemo(() => new Map(customers.map((c) => [c.id, c.name])), [customers]);
  const safeMap = useMemo(() => new Map(safes.map((s) => [s.id, s.name])), [safes]);

  const value: DataCtx = {
    customers, balances, safes, safeBalances, currencies, settings, loading, refresh,
    customerName: (id) => customerMap.get(id) ?? "",
    safeName: (id) => safeMap.get(id) ?? "",
  };

  return (
    <LanguageProvider>
      <ToastCtx.Provider value={{ toast }}>
        <Ctx.Provider value={value}>
          {children}
          <ToastHost toasts={toasts} />
        </Ctx.Provider>
      </ToastCtx.Provider>
    </LanguageProvider>
  );
}
