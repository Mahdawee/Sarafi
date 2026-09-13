"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { useLang } from "@/lib/i18n";

// ── Button ──
export function Btn({
  children, onClick, variant = "primary", size = "md", disabled, type, className = "", title,
}: {
  children: React.ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "danger" | "ghost" | "success" | "warning";
  size?: "sm" | "md" | "lg"; disabled?: boolean; type?: "button" | "submit"; className?: string; title?: string;
}) {
  const base = "inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer select-none";
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm", lg: "px-6 py-2.5 text-base" };
  const variants = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
    success: "bg-teal-600 text-white hover:bg-teal-700 shadow-sm",
    secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200",
    danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-sm",
    warning: "bg-amber-500 text-white hover:bg-amber-600 shadow-sm",
    ghost: "text-slate-600 hover:bg-slate-100",
  };
  return (
    <button type={type ?? "button"} title={title} onClick={onClick} disabled={disabled} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

// ── Card ──
export function Card({ children, className = "", title, action }: {
  children: React.ReactNode; className?: string; title?: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Field wrapper ──
export function Field({ label, children, required, className = "" }: {
  label: string; children: React.ReactNode; required?: boolean; className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold text-slate-500">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 placeholder:text-slate-400";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function NumInput({ value, onChange, ...rest }: {
  value: number | string; onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <input
      {...rest}
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputCls} text-left tabular-nums ${rest.className ?? ""}`}
      dir="ltr"
    />
  );
}

export function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${inputCls} cursor-pointer ${props.className ?? ""}`}>
      {children}
    </select>
  );
}

export function DateInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="date" {...props} className={`${inputCls} ${props.className ?? ""}`} dir="ltr" />;
}

// ── Badge ──
export function Badge({ color, children }: { color: "green" | "red" | "amber" | "blue" | "gray" | "purple"; children: React.ReactNode }) {
  const map = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red: "bg-rose-50 text-rose-700 border-rose-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    gray: "bg-slate-100 text-slate-600 border-slate-200",
    purple: "bg-violet-50 text-violet-700 border-violet-200",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${map[color]}`}>{children}</span>;
}

// ── Modal ──
export function Modal({ open, onClose, title, children, wide, footer }: {
  open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode;
  wide?: boolean; footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", fn);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" dir="inherit">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative flex max-h-[94vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${wide ? "max-w-6xl" : "max-w-lg"}`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-base font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="border-t border-slate-100 bg-slate-50 px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

// ── Confirm dialog ──
export function Confirm({ open, onClose, onYes, message, danger }: {
  open: boolean; onClose: () => void; onYes: () => void; message: string; danger?: boolean;
}) {
  const { t } = useLang();
  return (
    <Modal open={open} onClose={onClose} title={danger ? t("delete") : t("actions")}>
      <p className="text-sm text-slate-600">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Btn variant="secondary" onClick={onClose}>{t("no")}</Btn>
        <Btn variant={danger ? "danger" : "primary"} onClick={() => { onYes(); onClose(); }}>{t("yes")}</Btn>
      </div>
    </Modal>
  );
}

// ── Search box ──
export function SearchBox({ value, onChange, className = "" }: { value: string; onChange: (v: string) => void; className?: string }) {
  const { t } = useLang();
  return (
    <div className={`relative ${className}`}>
      <Search size={16} className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 start-3" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("search")}
        className={`${inputCls} ps-9`}
      />
    </div>
  );
}

// ── Empty / Spinner / Page header ──
export function Empty({ text }: { text?: string }) {
  const { t } = useLang();
  return <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">{text ?? t("noData")}</div>;
}

export function Spinner({ text }: { text?: string }) {
  const { t } = useLang();
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-slate-400">
      <Loader2 size={18} className="animate-spin" /> {text ?? t("loading")}
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-extrabold text-slate-800 sm:text-2xl">{title}</h1>
        {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}

// ── Segmented toggle ──
export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl bg-slate-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`cursor-pointer rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
            value === o.value ? "bg-white text-emerald-700 shadow" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Table ──
export function Tbl({ head, children, className = "" }: { head: React.ReactNode[]; children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/80 text-xs text-slate-500">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-3 py-2.5 text-start font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

// ── useState for modal forms: keep inputs mounted ──
export function useToggle(initial = false): [boolean, () => void, () => void] {
  const [v, setV] = useState(initial);
  return [v, () => setV(true), () => setV(false)];
}
