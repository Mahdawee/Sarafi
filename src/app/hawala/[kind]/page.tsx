"use client";

import React, { use, useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Plus, RotateCcw, Trash2, Undo2, XCircle } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { formatDate, formatMoney, formatNumber, parseNum, todayISO } from "@/lib/format";
import { useQuickEntry } from "@/lib/quick-entry";
import type { AccountRef, Hawala, HawalaStatus } from "@/lib/types";
import { AccountPicker, CurrencyPicker, SafePicker } from "@/components/pickers";
import MultiEntryModal from "@/components/MultiEntryModal";
import { PrintVoucherButton } from "@/components/PrintVoucher";
import { useData, useToast } from "@/components/app-providers";
import { Badge, Btn, Confirm, DateInput, Empty, Field, NumInput, PageHeader, SearchBox, Segmented, Select, Spinner, Tbl, TextInput } from "@/components/ui";

interface Row {
  date: string;
  sender_name: string; sender_phone: string;
  receiver_name: string; receiver_phone: string;
  from_city: string; to_city: string;
  sent_currency: string; sent_amount: string;
  received_currency: string; received_amount: string;
  exchange_rate: string;
  from_account: AccountRef | null;
  to_account: AccountRef | null;
  received_commission: string; paid_commission: string; commission_currency: string;
  payment_method: "cash" | "account";
  verification_status: "confirmed" | "pending";
  safe_id: number;
  secret: string; note: string;
  pay_now: boolean;
}

const blank = (): Row => ({
  date: todayISO(), sender_name: "", sender_phone: "", receiver_name: "", receiver_phone: "",
  from_city: "", to_city: "", sent_currency: "USD", sent_amount: "", received_currency: "USD", received_amount: "",
  exchange_rate: "", from_account: null, to_account: null, received_commission: "", paid_commission: "",
  commission_currency: "USD", payment_method: "cash", verification_status: "confirmed", safe_id: 0,
  secret: "", note: "", pay_now: false,
});

function sideAmount(h: Hawala, side: "sent" | "received") {
  if (side === "sent") return { currency: h.sent_currency || h.currency, amount: Number(h.sent_amount) || h.amount };
  return { currency: h.received_currency || h.sent_currency || h.currency, amount: Number(h.received_amount) || Number(h.sent_amount) || h.amount };
}

export default function HawalaPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = use(params);
  const isSend = kind === "send";
  const { t, locale } = useLang();
  const { toast } = useToast();
  const { refresh, safes } = useData();

  const [rows, setRows] = useState<Hawala[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [modal, setModal] = useState(false);
  const [entry, setEntry] = useState<Row[]>([blank()]);
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState<{ id: number; voucher: string } | null>(null);
  const [payTarget, setPayTarget] = useState<Hawala | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams({ kind });
      if (q) sp.set("q", q);
      if (status) sp.set("status", status);
      if (from) sp.set("from", from);
      if (to) sp.set("to", to);
      const result = await apiGet<{ hawala: Hawala[] }>(`/api/hawala?${sp}`);
      setRows(result.hawala);
    } catch (error) {
      toast(error instanceof Error ? error.message : t("error"), "error");
    } finally {
      setLoading(false);
    }
  }, [kind, q, status, from, to, toast, t]);

  useEffect(() => {
    const timer = window.setTimeout(load, 220);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    const timer = window.setTimeout(() => setEntry([blank()]), 0);
    return () => window.clearTimeout(timer);
  }, [kind]);

  const openModal = useCallback(() => {
    setEntry([{ ...blank(), safe_id: safes[0]?.id ?? 0 }]);
    setModal(true);
  }, [safes]);
  useQuickEntry(isSend ? "hawala-send" : "hawala-receive", openModal);

  const submit = async () => {
    for (const [index, row] of entry.entries()) {
      if (!row.sent_currency || !row.received_currency || parseNum(row.sent_amount) <= 0 || parseNum(row.received_amount) <= 0 || !row.from_account || !row.to_account) {
        toast(`${t("row")} ${locale === "fa" ? (index + 1).toLocaleString("fa-AF") : index + 1}: ${t("fillRequired")}`, "error");
        return;
      }
      if (row.payment_method === "cash" && !row.safe_id) {
        toast(`${t("row")} ${index + 1}: ${t("selectSafe")}`, "error");
        return;
      }
      if (row.pay_now && !row.safe_id) {
        toast(`${t("row")} ${index + 1}: ${t("selectSafe")}`, "error");
        return;
      }
    }

    setSubmitting(true);
    try {
      const result = await apiPost<{ voucher_no: string }>("/api/hawala", {
        kind,
        rows: entry.map((row) => {
          const principal = parseNum(row.sent_amount);
          const receivedCommission = parseNum(row.received_commission);
          const fallbackCustomer = row.from_account?.type === "customer" ? row.from_account.id : row.to_account?.type === "customer" ? row.to_account.id : 0;
          return {
            date: row.date, sender_name: row.sender_name, sender_phone: row.sender_phone,
            receiver_name: row.receiver_name, receiver_phone: row.receiver_phone,
            from_city: row.from_city, to_city: row.to_city,
            customer_id: fallbackCustomer,
            // Kept for the original API consumers too.
            currency: row.sent_currency, amount: principal, fee: receivedCommission,
            cash_amount: row.payment_method === "cash" ? principal + receivedCommission : 0,
            safe_id: row.safe_id, secret: row.secret, note: row.note, pay_now: row.pay_now,
            sent_currency: row.sent_currency, sent_amount: principal,
            received_currency: row.received_currency, received_amount: parseNum(row.received_amount),
            exchange_rate: parseNum(row.exchange_rate),
            from_account: row.from_account, to_account: row.to_account,
            received_commission: receivedCommission, paid_commission: parseNum(row.paid_commission),
            commission_currency: row.commission_currency || row.sent_currency,
            payment_method: row.payment_method, verification_status: row.verification_status,
          };
        }),
      });
      toast(`${t("saved")} — ${result.voucher_no}`, "success");
      setModal(false);
      setEntry([blank()]);
      await Promise.all([load(), refresh()]);
    } catch (error) {
      toast(error instanceof Error ? error.message : t("error"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const doAction = async (id: number, action: string, safe_id?: number) => {
    try {
      await apiPatch(`/api/hawala/${id}`, { action, safe_id });
      toast(t("saved"), "success");
      setPayTarget(null);
      await Promise.all([load(), refresh()]);
    } catch (error) {
      toast(error instanceof Error ? error.message : t("error"), "error");
    }
  };

  const doDelete = async () => {
    if (!confirm) return;
    try {
      await apiDelete(`/api/hawala/${confirm.id}`);
      toast(t("deleted"), "success");
      await Promise.all([load(), refresh()]);
    } catch (error) {
      toast(error instanceof Error ? error.message : t("error"), "error");
    }
  };

  const statusBadge = (value: HawalaStatus) => value === "paid"
    ? <Badge color="green">{t("paid")}</Badge>
    : value === "cancelled" ? <Badge color="red">{t("cancelled")}</Badge>
    : <Badge color="amber">{t("pending")}</Badge>;

  const totals = useMemo(() => entry.reduce<Record<string, { sent: number; received: number }>>((all, row) => {
    const sent = parseNum(row.sent_amount); const received = parseNum(row.received_amount);
    if (sent) (all[row.sent_currency] ??= { sent: 0, received: 0 }).sent += sent;
    if (received) (all[row.received_currency] ??= { sent: 0, received: 0 }).received += received;
    return all;
  }, {}), [entry]);

  return (
    <div>
      <PageHeader
        title={isSend ? t("nav_hawala_send") : t("nav_hawala_receive")}
        sub={t("multiHint")}
        actions={<Btn onClick={openModal}><Plus size={16} /> {isSend ? t("newSendHawala") : t("newReceiveHawala")}</Btn>}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <SearchBox value={q} onChange={setQ} className="min-w-48 flex-1" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto"><option value="">{t("status")}: {t("all")}</option><option value="pending">{t("pending")}</option><option value="paid">{t("paid")}</option><option value="cancelled">{t("cancelled")}</option></Select>
        <DateInput value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" title={t("from")} />
        <DateInput value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" title={t("to")} />
      </div>

      {loading ? <Spinner /> : rows.length === 0 ? <Empty /> : (
        <Tbl head={[t("voucherNo"), t("date"), t("sender"), t("receiver"), t("sentAmount"), t("exchangeRate"), t("receivedAmount"), t("fromAccount"), t("toAccount"), t("fee"), t("status"), t("actions")]}>
          {rows.map((hawala) => {
            const sent = sideAmount(hawala, "sent");
            const received = sideAmount(hawala, "received");
            const commission = Number(hawala.received_commission) || hawala.fee;
            return (
              <tr key={hawala.id} className="hover:bg-cyan-50/30">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-bold text-slate-600" dir="ltr">{hawala.voucher_no}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">{formatDate(hawala.date, locale)}</td>
                <td className="px-3 py-2"><div className="font-semibold text-slate-700">{hawala.sender_name || "—"}</div><div className="text-[10px] text-slate-400" dir="ltr">{hawala.sender_phone}</div></td>
                <td className="px-3 py-2"><div className="font-semibold text-slate-700">{hawala.receiver_name || "—"}</div><div className="text-[10px] text-slate-400" dir="ltr">{hawala.receiver_phone}</div></td>
                <td className="whitespace-nowrap px-3 py-2 text-xs font-extrabold text-slate-800" dir="ltr">{formatMoney(sent.amount, sent.currency, locale)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500" dir="ltr">{hawala.exchange_rate ? formatNumber(hawala.exchange_rate, locale, 5) : "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs font-extrabold text-cyan-800" dir="ltr">{formatMoney(received.amount, received.currency, locale)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">{hawala.from_account_name || hawala.customer_name || "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">{hawala.to_account_name || "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-violet-700" dir="ltr">{commission ? formatMoney(commission, hawala.commission_currency || sent.currency, locale) : "—"}</td>
                <td className="px-3 py-2"><div className="flex flex-col items-start gap-1">{statusBadge(hawala.status)}{hawala.verification_status === "pending" && <Badge color="gray">{t("verification")}</Badge>}</div></td>
                <td className="px-3 py-2"><div className="flex items-center gap-0.5">
                  {hawala.status === "pending" && <Btn variant="ghost" size="sm" title={t("markPaid")} onClick={() => setPayTarget(hawala)}><CheckCircle2 size={15} className="text-emerald-600" /></Btn>}
                  {hawala.status === "paid" && <Btn variant="ghost" size="sm" title={t("markUnpaid")} onClick={() => doAction(hawala.id, "unpay")}><Undo2 size={15} className="text-amber-600" /></Btn>}
                  {hawala.status !== "paid" && hawala.status !== "cancelled" && <Btn variant="ghost" size="sm" title={t("cancelled")} onClick={() => doAction(hawala.id, "cancel")}><XCircle size={15} className="text-slate-400" /></Btn>}
                  {hawala.status === "cancelled" && <Btn variant="ghost" size="sm" title={t("pending")} onClick={() => doAction(hawala.id, "restore")}><RotateCcw size={15} className="text-blue-500" /></Btn>}
                  <PrintVoucherButton voucherNo={hawala.voucher_no} />
                  <Btn variant="ghost" size="sm" title={t("delete")} onClick={() => setConfirm({ id: hawala.id, voucher: hawala.voucher_no })}><Trash2 size={15} className="text-rose-500" /></Btn>
                </div></td>
              </tr>
            );
          })}
        </Tbl>
      )}

      <MultiEntryModal
        open={modal}
        onClose={() => setModal(false)}
        title={isSend ? t("newSendHawala") : t("newReceiveHawala")}
        rows={entry}
        setRows={setEntry}
        blankRow={blank}
        submitting={submitting}
        onSubmit={submit}
        footer={<span className="text-xs font-bold text-slate-600" dir="ltr">{Object.entries(totals).map(([currency, total]) => `${currency}: ${formatNumber(total.sent, locale)} → ${formatNumber(total.received, locale)}`).join("  •  ") || `${t("total")}: 0`}</span>}
        renderRow={(row, _index, update) => (
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
              <Field label={t("date")} required><DateInput value={row.date} onChange={(e) => update({ date: e.target.value })} /></Field>
              <Field label={t("paymentMethod")}><Segmented value={row.payment_method} onChange={(payment_method) => update({ payment_method })} options={[{ value: "cash", label: t("cash") }, { value: "account", label: t("onAccount") }]} /></Field>
              <Field label={t("verification")}><Segmented value={row.verification_status} onChange={(verification_status) => update({ verification_status })} options={[{ value: "confirmed", label: t("confirmed") }, { value: "pending", label: t("pending") }]} /></Field>
              <Field label={t("secret")}><TextInput value={row.secret} onChange={(e) => update({ secret: e.target.value })} dir="ltr" placeholder="—" /></Field>
              <Field label={t("note")}><TextInput value={row.note} onChange={(e) => update({ note: e.target.value })} placeholder={locale === "fa" ? "جزئیات…" : "Details…"} /></Field>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="mb-2 text-xs font-extrabold text-slate-700">{t("hawalaParties")}</div>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <Field label={t("senderName")}><TextInput value={row.sender_name} onChange={(e) => update({ sender_name: e.target.value })} /></Field>
                <Field label={t("senderPhone")}><TextInput value={row.sender_phone} onChange={(e) => update({ sender_phone: e.target.value })} dir="ltr" /></Field>
                <Field label={t("receiverName")}><TextInput value={row.receiver_name} onChange={(e) => update({ receiver_name: e.target.value })} /></Field>
                <Field label={t("receiverPhone")}><TextInput value={row.receiver_phone} onChange={(e) => update({ receiver_phone: e.target.value })} dir="ltr" /></Field>
                <Field label={t("fromCity")}><TextInput value={row.from_city} onChange={(e) => update({ from_city: e.target.value })} /></Field>
                <Field label={t("toCity")}><TextInput value={row.to_city} onChange={(e) => update({ to_city: e.target.value })} /></Field>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border-2 border-cyan-200 bg-cyan-50/40 p-3">
                <div className="mb-2 text-center text-sm font-extrabold text-cyan-950">{isSend ? (locale === "fa" ? "مبلغ گرفته‌شده برای حواله" : "Hawala send amount") : "Hawala Send Amount"}</div>
                <div className="grid grid-cols-2 gap-2"><Field label={t("sentCurrency")} required><CurrencyPicker value={row.sent_currency} onChange={(sent_currency) => update({ sent_currency, commission_currency: row.commission_currency || sent_currency })} /></Field><Field label={t("sentAmount")} required><NumInput value={row.sent_amount} onChange={(sent_amount) => update({ sent_amount })} placeholder="0" autoFocus /></Field></div>
              </div>
              <div className="rounded-2xl border-2 border-violet-200 bg-violet-50/40 p-3">
                <div className="mb-2 text-center text-sm font-extrabold text-violet-950">{isSend ? (locale === "fa" ? "مبلغ تبادله‌شده برای اجرا" : "Hawala received amount") : "Hawala Received Amount"}</div>
                <div className="grid grid-cols-3 gap-2"><Field label={t("receivedCurrency")} required><CurrencyPicker value={row.received_currency} onChange={(received_currency) => update({ received_currency })} /></Field><Field label={t("receivedAmount")} required><NumInput value={row.received_amount} onChange={(received_amount) => update({ received_amount })} placeholder="0" /></Field><Field label={t("exchangeRate")}><NumInput value={row.exchange_rate} onChange={(exchange_rate) => update({ exchange_rate })} placeholder="0" /></Field></div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="mb-2 text-xs font-extrabold text-slate-700">{t("hawalaAccounts")}</div>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <Field label={t("fromAccount")} required><AccountPicker value={row.from_account} onChange={(from_account) => update({ from_account })} exclude={row.to_account} /></Field>
                <Field label={t("toAccount")} required><AccountPicker value={row.to_account} onChange={(to_account) => update({ to_account })} exclude={row.from_account} /></Field>
                <Field label={t("receivedCommission")}><NumInput value={row.received_commission} onChange={(received_commission) => update({ received_commission })} placeholder="0" /></Field>
                <Field label={t("paidCommission")}><NumInput value={row.paid_commission} onChange={(paid_commission) => update({ paid_commission })} placeholder="0" /></Field>
                <Field label={t("currency")}><CurrencyPicker value={row.commission_currency} onChange={(commission_currency) => update({ commission_currency })} /></Field>
                <Field label={t("paySafe")} className="lg:col-span-1"><SafePicker value={row.safe_id} onChange={(safe_id) => update({ safe_id })} showBalances /></Field>
                <label className="flex cursor-pointer items-center gap-2 self-end rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 lg:col-span-2"><input type="checkbox" checked={row.pay_now} onChange={(e) => update({ pay_now: e.target.checked })} className="h-4 w-4 accent-emerald-600" />{t("payNow")}</label>
              </div>
            </div>
          </div>
        )}
      />

      {payTarget && <PayDialog hawala={payTarget} onClose={() => setPayTarget(null)} onPay={(safe_id) => doAction(payTarget.id, "pay", safe_id)} />}
      <Confirm open={!!confirm} onClose={() => setConfirm(null)} onYes={doDelete} danger message={`${t("confirmDelete")} (${confirm?.voucher})`} />
    </div>
  );
}

function PayDialog({ hawala, onClose, onPay }: { hawala: Hawala; onClose: () => void; onPay: (safe_id: number) => void }) {
  const { t, locale } = useLang();
  const [safeId, setSafeId] = useState(hawala.safe_id || 0);
  const amount = sideAmount(hawala, "received");
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="mb-1 text-base font-bold">{t("markPaid")}</h3>
        <p className="mb-3 text-sm text-slate-500" dir="ltr">{hawala.voucher_no} • {formatMoney(amount.amount, amount.currency, locale)}</p>
        <Field label={t("paySafe")} required><SafePicker value={safeId} onChange={setSafeId} showBalances /></Field>
        <div className="mt-4 flex justify-end gap-2"><Btn variant="secondary" onClick={onClose}>{t("cancel")}</Btn><Btn onClick={() => onPay(safeId)} disabled={!safeId}><CheckCircle2 size={16} /> {t("markPaid")}</Btn></div>
      </div>
    </div>
  );
}
