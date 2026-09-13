import { toJalaali } from "jalaali-js";
import type { Locale } from "./types";

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function toFaDigits(s: string | number): string {
  return String(s).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

export function formatNumber(n: number | null | undefined, locale: Locale = "fa", decimals = 2): string {
  if (n === null || n === undefined || isNaN(n)) return locale === "fa" ? "۰" : "0";
  // Trim unnecessary decimals for clean display
  const abs = Math.abs(n);
  let d = decimals;
  if (abs !== 0 && abs < 1) d = 4;
  const grouped = n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: d });
  return locale === "fa" ? toFaDigits(grouped) : grouped;
}

export function formatMoney(n: number | null | undefined, currency = "", locale: Locale = "fa"): string {
  const num = formatNumber(n, locale);
  return currency ? `${num} ${currency}` : num;
}

const FA_MONTHS = ["حمل", "ثور", "جوزا", "سرطان", "اسد", "سنبله", "میزان", "عقرب", "قوس", "جدی", "دلو", "حوت"];

/** ISO yyyy-mm-dd -> Jalali display (fa) or gregorian (en) */
export function formatDate(iso: string | null | undefined, locale: Locale = "fa"): string {
  if (!iso) return "—";
  const part = iso.slice(0, 10);
  const [y, m, d] = part.split("-").map(Number);
  if (!y || !m || !d) return iso;
  if (locale === "fa") {
    try {
      const j = toJalaali(y, m, d);
      return toFaDigits(`${j.jy}/${String(j.jm).padStart(2, "0")}/${String(j.jd).padStart(2, "0")}`);
    } catch {
      return toFaDigits(part);
    }
  }
  return part;
}

export function formatDateLong(iso: string | null | undefined, locale: Locale = "fa"): string {
  if (!iso) return "—";
  const part = iso.slice(0, 10);
  const [y, m, d] = part.split("-").map(Number);
  if (!y || !m || !d) return iso;
  if (locale === "fa") {
    try {
      const j = toJalaali(y, m, d);
      return toFaDigits(`${j.jd} ${FA_MONTHS[j.jm - 1]} ${j.jy}`);
    } catch {
      return toFaDigits(part);
    }
  }
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseNum(v: unknown): number {
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  if (typeof v === "string") {
    // Convert Persian/Arabic digits to latin
    const latin = v.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
    const n = parseFloat(latin.replace(/,/g, ""));
    return isNaN(n) ? 0 : n;
  }
  return 0;
}
