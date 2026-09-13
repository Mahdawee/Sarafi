"use client";

import React, { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useData, useToast } from "./app-providers";
import { apiPost } from "@/lib/api";
import type { AccountRef } from "@/lib/types";
import { Btn, Field, Modal, Select, TextInput } from "./ui";

// ── Customer picker with search + quick add ──
export function CustomerPicker({ value, onChange, autoFocus }: {
  value: number; onChange: (id: number) => void; autoFocus?: boolean;
}) {
  const { t } = useLang();
  const { customers, balances, refresh } = useData();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", fn);
    return () => window.removeEventListener("mousedown", fn);
  }, []);

  const selected = customers.find((c) => c.id === value);
  const filtered = customers.filter(
    (c) => !q || c.name.includes(q) || c.phone.includes(q) || c.code.toLowerCase().includes(q.toLowerCase())
  );

  const quickAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await apiPost<{ customer: { id: number } }>("/api/customers", { name: name.trim(), phone: phone.trim() });
      await refresh();
      onChange(res.customer.id);
      setShowAdd(false);
      setName(""); setPhone(""); setQ("");
      toast(t("saved"), "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        autoFocus={autoFocus}
        onClick={() => { setOpen(!open); setQ(""); }}
        className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-start text-sm text-slate-800 outline-none transition focus:border-emerald-500"
      >
        {selected ? (
          <span className="flex items-center justify-between gap-2">
            <span className="truncate font-medium">{selected.name}</span>
            <span className="shrink-0 text-[11px] text-slate-400" dir="ltr">{selected.code}</span>
          </span>
        ) : (
          <span className="text-slate-400">{t("selectCustomer")}</span>
        )}
      </button>
      {open && (
        <div className="absolute z-40 mt-1 max-h-72 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 p-2">
            <TextInput
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("search")}
              onKeyDown={(e) => {
                if (e.key === "Enter" && filtered.length > 0) { onChange(filtered[0].id); setOpen(false); }
              }}
            />
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {filtered.slice(0, 50).map((c) => (
              <button
                key={c.id}
                onClick={() => { onChange(c.id); setOpen(false); }}
                className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-start text-sm hover:bg-emerald-50 ${c.id === value ? "bg-emerald-50 font-bold text-emerald-800" : "text-slate-700"}`}
              >
                <span className="truncate">{c.name}</span>
                <span className="shrink-0 text-[11px] text-slate-400" dir="ltr">{c.code}</span>
              </button>
            ))}
            {filtered.length === 0 && <div className="px-3 py-4 text-center text-xs text-slate-400">{t("noData")}</div>}
          </div>
          <div className="border-t border-slate-100 p-2">
            <Btn variant="secondary" size="sm" className="w-full" onClick={() => { setShowAdd(true); setOpen(false); setName(q); }}>
              <Plus size={14} /> {t("newCustomer")}
            </Btn>
          </div>
        </div>
      )}
      {selected && balances[selected.id] && (
        <div className="mt-1 flex flex-wrap gap-1">
          {Object.entries(balances[selected.id]).map(([cur, b]) => (
            b.balance !== 0 && (
              <span key={cur} dir="ltr" className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${b.balance > 0 ? "bg-blue-50 text-blue-700" : "bg-rose-50 text-rose-700"}`}>
                {cur} {b.balance.toLocaleString()}
              </span>
            )
          ))}
        </div>
      )}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={t("newCustomer")}>
        <div className="space-y-3">
          <Field label={t("name")} required><TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
          <Field label={t("phone")}><TextInput value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="secondary" onClick={() => setShowAdd(false)}>{t("cancel")}</Btn>
            <Btn onClick={quickAdd} disabled={saving || !name.trim()}>{saving ? t("saving") : t("save")}</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Safe picker ──
export function SafePicker({ value, onChange, showBalances }: {
  value: number; onChange: (id: number) => void; showBalances?: boolean;
}) {
  const { t } = useLang();
  const { safes, safeBalances } = useData();
  const selected = safes.find((s) => s.id === value);
  return (
    <div>
      <Select value={value || ""} onChange={(e) => onChange(Number(e.target.value))}>
        <option value="">{t("selectSafe")}</option>
        {safes.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </Select>
      {showBalances && selected && safeBalances[selected.id] && (
        <div className="mt-1 flex flex-wrap gap-1">
          {Object.entries(safeBalances[selected.id]).map(([cur, b]) => (
            <span key={cur} dir="ltr" className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
              {cur} {Number(b).toLocaleString()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Unified account picker (customer/agent + cash/bank) ──
// General journal rows must be able to address either kind of account.  The
// selected value is explicit, so customer #1 and safe #1 can never collide.
export function AccountPicker({
  value,
  onChange,
  exclude,
}: {
  value: AccountRef | null;
  onChange: (value: AccountRef | null) => void;
  exclude?: AccountRef | null;
}) {
  const { t, locale } = useLang();
  const { customers, safes, balances, safeBalances } = useData();
  const valueKey = value ? `${value.type}:${value.id}` : "";
  const excludedKey = exclude ? `${exclude.type}:${exclude.id}` : "";
  const selectedName = value?.type === "customer"
    ? customers.find((c) => c.id === value.id)?.name
    : value?.type === "safe" ? safes.find((s) => s.id === value.id)?.name : "";
  const selectedBalance = value?.type === "customer"
    ? Object.entries(balances[value.id] ?? {}).map(([currency, b]) => `${currency} ${Number(b.balance).toLocaleString()}`).join(" · ")
    : value?.type === "safe" ? Object.entries(safeBalances[value.id] ?? {}).map(([currency, b]) => `${currency} ${Number(b).toLocaleString()}`).join(" · ") : "";

  return (
    <div>
      <Select
        value={valueKey}
        onChange={(e) => {
          if (!e.target.value) return onChange(null);
          const [type, id] = e.target.value.split(":");
          onChange({ type: type as AccountRef["type"], id: Number(id) });
        }}
      >
        <option value="">{locale === "fa" ? "انتخاب حساب..." : "Select account..."}</option>
        <optgroup label={locale === "fa" ? "حساب مشتریان و نمایندگان" : "Customer & agent accounts"}>
          {customers.map((c) => {
            const key = `customer:${c.id}`;
            return <option key={key} value={key} disabled={key === excludedKey}>{c.name} — {c.code}</option>;
          })}
        </optgroup>
        <optgroup label={locale === "fa" ? "صندوق‌ها و بانک‌ها" : "Safes & banks"}>
          {safes.map((s) => {
            const key = `safe:${s.id}`;
            return <option key={key} value={key} disabled={key === excludedKey}>{s.name}</option>;
          })}
        </optgroup>
      </Select>
      {selectedName && selectedBalance && (
        <div className="mt-1 truncate text-[10px] font-semibold text-slate-400" dir="ltr" title={`${selectedName}: ${selectedBalance}`}>
          {selectedBalance}
        </div>
      )}
      {!selectedName && value && <div className="mt-1 text-[10px] text-rose-500">{t("noData")}</div>}
    </div>
  );
}

// ── Currency picker ──
export function CurrencyPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { currencies } = useData();
  const { locale } = useLang();
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} dir="ltr" className="text-left">
      <option value="">---</option>
      {currencies.map((c) => (
        <option key={c.code} value={c.code}>{c.code} — {locale === "fa" ? c.name_fa : c.name_en}</option>
      ))}
    </Select>
  );
}
