"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Printer } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useData } from "./app-providers";
import { apiGet } from "@/lib/api";
import { formatDateLong, formatMoney } from "@/lib/format";
import { Btn } from "./ui";

interface VoucherData {
  voucher_no: string;
  hawala: Record<string, unknown>[];
  receipts: Record<string, unknown>[];
  dc: Record<string, unknown>[];
  exchanges: Record<string, unknown>[];
  expenses: Record<string, unknown>[];
  transfers: Record<string, unknown>[];
}

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v ?? 0);
}
function str(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

export function PrintVoucherButton({ voucherNo, size = "sm" }: { voucherNo: string; size?: "sm" | "md" }) {
  const { t, locale } = useLang();
  const { settings } = useData();
  const [data, setData] = useState<VoucherData | null>(null);
  const [busy, setBusy] = useState(false);

  const doPrint = async () => {
    setBusy(true);
    try {
      const d = await apiGet<VoucherData>(`/api/vouchers/${voucherNo}`);
      setData(d);
      // Wait for portal to render, then print
      setTimeout(() => {
        window.print();
        setTimeout(() => setData(null), 500);
      }, 150);
    } finally {
      setBusy(false);
    }
  };

  const company = locale === "fa" ? settings.company_fa : settings.company_en;
  const footer = locale === "fa" ? settings.receipt_footer_fa : settings.receipt_footer_en;
  const addr = locale === "fa" ? settings.address_fa : settings.address_en;

  const rows: { label: string; detail: string; amount: string }[] = [];
  if (data) {
    for (const h of data.hawala) {
      const isSend = str(h.kind) === "send";
      rows.push({
        label: isSend ? t("sendHawala") : t("receiveHawala"),
        detail: `${t("sender")}: ${str(h.sender_name)} ← ${t("receiver")}: ${str(h.receiver_name)}${str(h.secret) ? ` • ${t("secret")}: ${str(h.secret)}` : ""}${str(h.note) ? ` • ${str(h.note)}` : ""}`,
        amount: formatMoney(num(h.amount), str(h.currency), locale),
      });
      if (num(h.fee) > 0)
        rows.push({ label: t("fee"), detail: "", amount: formatMoney(num(h.fee), str(h.currency), locale) });
    }
    for (const r of data.receipts) {
      rows.push({
        label: str(r.kind) === "receive" ? t("receiveReceipt") : t("payReceipt"),
        detail: `${str(r.kind) === "receive" ? t("receivedFrom") : t("paidTo")}: ${str(r.customer_name)} • ${t("safe")}: ${str(r.safe_name)}${str(r.description) ? ` • ${str(r.description)}` : ""}`,
        amount: formatMoney(num(r.amount), str(r.currency), locale),
      });
    }
    for (const d of data.dc) {
      rows.push({
        label: str(d.kind) === "debit" ? t("debitNote") : t("creditNote"),
        detail: `${t("customer")}: ${str(d.customer_name)}${str(d.reason) ? ` • ${str(d.reason)}` : ""}`,
        amount: formatMoney(num(d.amount), str(d.currency), locale),
      });
    }
    for (const e of data.exchanges) {
      rows.push({
        label: str(e.kind) === "buy" ? t("buyCurrency") : t("sellCurrency"),
        detail: `${formatMoney(num(e.foreign_amount), str(e.foreign_currency), locale)} × ${num(e.rate)}${str(e.customer_name) ? ` • ${str(e.customer_name)}` : ""}${str(e.note) ? ` • ${str(e.note)}` : ""}`,
        amount: formatMoney(num(e.base_amount), "AFN", locale),
      });
    }
    for (const e of data.expenses) {
      rows.push({
        label: t("newExpense"),
        detail: `${str(e.category)} • ${t("safe")}: ${str(e.safe_name)} • ${str(e.description)}`,
        amount: formatMoney(num(e.amount), str(e.currency), locale),
      });
    }
    for (const x of data.transfers) {
      rows.push({
        label: t("transfer"),
        detail: `${str(x.from_safe_name)} ← ${str(x.to_safe_name)}${str(x.description) ? ` • ${str(x.description)}` : ""}`,
        amount: formatMoney(num(x.amount), str(x.currency), locale),
      });
    }
  }
  const firstDate = data ? str(
    data.hawala[0]?.date ?? data.receipts[0]?.date ?? data.dc[0]?.date ??
    data.exchanges[0]?.date ?? data.expenses[0]?.date ?? data.transfers[0]?.date
  ) : "";

  return (
    <>
      <Btn variant="ghost" size={size} onClick={doPrint} disabled={busy} title={t("print")}>
        <Printer size={15} />
      </Btn>
      {data &&
        createPortal(
          <div id="print-root" dir={locale === "fa" ? "rtl" : "ltr"}>
            <div className="print-doc">
              <div className="print-head">
                <h1>{company}</h1>
                <p>{addr}{settings.phone ? ` • ${settings.phone}` : ""}</p>
              </div>
              <div className="print-meta">
                <span>{t("voucherNo")}: <b dir="ltr">{data.voucher_no}</b></span>
                <span>{t("date")}: <b>{formatDateLong(firstDate, locale)}</b></span>
              </div>
              <table className="print-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>{t("row")}</th>
                    <th>{t("description")}</th>
                    <th style={{ width: 150 }}>{t("amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td>{locale === "fa" ? (i + 1).toLocaleString("fa-AF") : i + 1}</td>
                      <td>
                        <b>{r.label}</b>
                        {r.detail && <div className="print-detail">{r.detail}</div>}
                      </td>
                      <td className="print-amount">{r.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="print-sign">
                <div><span>{locale === "fa" ? "امضای مشتری" : "Customer signature"}</span></div>
                <div><span>{locale === "fa" ? "امضای صرافی" : "Exchange signature"}</span></div>
              </div>
              {footer && <p className="print-footer">{footer}</p>}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
