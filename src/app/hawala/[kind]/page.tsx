"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import { CheckCircle2, Plus, RotateCcw, Trash2, Undo2, XCircle } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { formatDate, formatMoney, parseNum, todayISO } from "@/lib/format";
import type { Hawala, HawalaStatus } from "@/lib/types";
import { Badge, Btn, Confirm, DateInput, Empty, Field, NumInput, PageHeader, SearchBox, Select, Spinner, Tbl, TextInput } from "@/components/ui";
import { CurrencyPicker, CustomerPicker, SafePicker } from "@/components/pickers";
import MultiEntryModal from "@/components/MultiEntryModal";
import { PrintVoucherButton } from "@/components/PrintVoucher";
import { useData, useToast } from "@/components/app-providers";

interface Row {
  date: string;
  sender_name: string; sender_phone: string;
  receiver_name: string; receiver_phone: string;
  from_city: string; to_city: string;
  customer_id: number;
  currency: string;
  amount: string; fee: string; cash_amount: string;
  safe_id: number;
  secret: string; note: string;
  pay_now: boolean;
}

const blank = (): Row => ({
  date: todayISO(), sender_name: "", sender_phone: "", receiver_name: "", receiver_phone: "",
  from_city: "", to_city: "", customer_id: 0, currency: "USD", amount: "", fee: "", cash_amount: "",
  safe_id: 0, secret: "", note: "", pay_now: false,
});

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
      const d = await apiGet<{ hawala: Hawala[] }>(`/api/hawala?${sp}`);
      setRows(d.hawala);
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"), "error");
    } finally {
      setLoading(false);
    }
  }, [kind, q, status, from, to, toast, t]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);
  useEffect(() => { setEntry([blank()]); }, [kind]);

  const openModal = () => {
    setEntry([{ ...blank(), safe_id: safes[0]?.id ?? 0 }]);
    setModal(true);
  };

  const submit = async () => {
    for (const [i, r] of entry.entries()) {
      if (!r.customer_id || !r.currency || parseNum(r.amount) <= 0) {
        toast(`${t("row")} ${i + 1}: ${t("fillRequired")}`, "error");
        return;
      }
      if (isSend && parseNum(r.cash_amount) > 0 && !r.safe_id) {
        toast(`${t("row")} ${i + 1}: ${t("selectSafe")}`, "error");
        return;
      }
      if (r.pay_now && !r.safe_id) {
        toast(`${t("row")} ${i + 1}: ${t("selectSafe")}`, "error");
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await apiPost<{ voucher_no: string }>("/api/hawala", {
        kind,
        rows: entry.map((r) => ({
          date: r.date, sender_name: r.sender_name, sender_phone: r.sender_phone,
          receiver_name: r.receiver_name, receiver_phone: r.receiver_phone,
          from_city: r.from_city, to_city: r.to_city, customer_id: r.customer_id,
          currency: r.currency, amount: parseNum(r.amount), fee: parseNum(r.fee),
          cash_amount: parseNum(r.cash_amount), safe_id: r.safe_id,
          secret: r.secret, note: r.note, pay_now: r.pay_now,
        })),
      });
      toast(`${t("saved")} — ${res.voucher_no}`, "success");
      setModal(false);
      setEntry([blank()]);
      load();
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const doAction = async (id: number, action: string, safe_id?: number) => {
    try {
      await apiPatch(`/api/hawala/${id}`, { action, safe_id });
      toast(t("saved"), "success");
      setPayTarget(null);
      load();
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"), "error");
    }
  };

  const doDelete = async () => {
    if (!confirm) return;
    try {
      await apiDelete(`/api/hawala/${confirm.id}`);
      toast(t("deleted"), "success");
      load();
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"), "error");
    }
  };

  const statusBadge = (s: HawalaStatus) =>
    s === "paid" ? <Badge color="green">{t("paid")}</Badge>
    : s === "cancelled" ? <Badge color="red">{t("cancelled")}</Badge>
    : <Badge color="amber">{t("pending")}</Badge>;

  const totalAmount = entry.reduce((s, r) => s + parseNum(r.amount), 0);
  const totalFee = entry.reduce((s, r) => s + parseNum(r.fee), 0);

  return (
    <div>
      <PageHeader
        title={isSend ? t("nav_hawala_send") : t("nav_hawala_receive")}
        sub={t("multiHint")}
        actions={<Btn onClick={openModal}><Plus size={16} /> {isSend ? t("newSendHawala") : t("newReceiveHawala")}</Btn>}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={setQ} className="min-w-52 flex-1" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
          <option value="">{t("status")}: {t("all")}</option>
          <option value="pending">{t("pending")}</option>
          <option value="paid">{t("paid")}</option>
          <option value="cancelled">{t("cancelled")}</option>
        </Select>
        <DateInput value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" title={t("from")} />
        <DateInput value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" title={t("to")} />
      </div>

      {loading ? <Spinner /> : rows.length === 0 ? <Empty /> : (
        <Tbl head={[t("voucherNo"), t("date"), t("sender"), t("receiver"), t("customer"), t("amount"), t("fee"), t("status"), t("actions")]}>
          {rows.map((h) => (
            <tr key={h.id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-bold text-slate-600" dir="ltr">{h.voucher_no}</td>
              <td className="whitespace-nowrap px-3 py-2 text-xs">{formatDate(h.date, locale)}</td>
              <td className="px-3 py-2">
                <div className="font-semibold text-slate-700">{h.sender_name || "—"}</div>
                <div className="text-[11px] text-slate-400" dir="ltr">{h.sender_phone}</div>
              </td>
              <td className="px-3 py-2">
                <div className="font-semibold text-slate-700">{h.receiver_name || "—"}</div>
                <div className="text-[11px] text-slate-400" dir="ltr">{h.receiver_phone}</div>
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-xs">{h.customer_name || "—"}</td>
              <td className="whitespace-nowrap px-3 py-2 text-xs font-extrabold" dir="ltr">{formatMoney(h.amount, h.currency, locale)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-xs" dir="ltr">{formatMoney(h.fee, "", locale)}</td>
              <td className="px-3 py-2">{statusBadge(h.status)}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-0.5">
                  {h.status === "pending" && (
                    <Btn variant="ghost" size="sm" title={t("markPaid")} onClick={() => setPayTarget(h)}>
                      <CheckCircle2 size={15} className="text-emerald-600" />
                    </Btn>
                  )}
                  {h.status === "paid" && (
                    <Btn variant="ghost" size="sm" title={t("markUnpaid")} onClick={() => doAction(h.id, "unpay")}>
                      <Undo2 size={15} className="text-amber-600" />
                    </Btn>
                  )}
                  {h.status !== "paid" && h.status !== "cancelled" && (
                    <Btn variant="ghost" size="sm" title={t("cancelled")} onClick={() => doAction(h.id, "cancel")}>
                      <XCircle size={15} className="text-slate-400" />
                    </Btn>
                  )}
                  {h.status === "cancelled" && (
                    <Btn variant="ghost" size="sm" title={t("pending")} onClick={() => doAction(h.id, "restore")}>
                      <RotateCcw size={15} className="text-blue-500" />
                    </Btn>
                  )}
                  <PrintVoucherButton voucherNo={h.voucher_no} />
                  <Btn variant="ghost" size="sm" title={t("delete")} onClick={() => setConfirm({ id: h.id, voucher: h.voucher_no })}>
                    <Trash2 size={15} className="text-rose-500" />
                  </Btn>
                </div>
              </td>
            </tr>
          ))}
        </Tbl>
      )}

      {/* ── Multi-entry popup ── */}
      <MultiEntryModal
        open={modal}
        onClose={() => setModal(false)}
        title={isSend ? t("newSendHawala") : t("newReceiveHawala")}
        rows={entry}
        setRows={setEntry}
        blankRow={blank}
        submitting={submitting}
        onSubmit={submit}
        footer={
          <span className="text-xs font-bold text-slate-600" dir="ltr">
            {t("total")}: {formatMoney(totalAmount, "", locale)} + {t("fee")}: {formatMoney(totalFee, "", locale)}
          </span>
        }
        renderRow={(r, idx, update) => (
          <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-3 lg:grid-cols-4">
            <Field label={t("date")} required><DateInput value={r.date} onChange={(e) => update({ date: e.target.value })} /></Field>
            <Field label={t("customer")} required><CustomerPicker value={r.customer_id} onChange={(v) => update({ customer_id: v })} /></Field>
            <Field label={t("senderName")}><TextInput value={r.sender_name} onChange={(e) => update({ sender_name: e.target.value })} /></Field>
            <Field label={t("senderPhone")}><TextInput value={r.sender_phone} onChange={(e) => update({ sender_phone: e.target.value })} dir="ltr" /></Field>
            <Field label={t("receiverName")}><TextInput value={r.receiver_name} onChange={(e) => update({ receiver_name: e.target.value })} /></Field>
            <Field label={t("receiverPhone")}><TextInput value={r.receiver_phone} onChange={(e) => update({ receiver_phone: e.target.value })} dir="ltr" /></Field>
            <Field label={t("fromCity")}><TextInput value={r.from_city} onChange={(e) => update({ from_city: e.target.value })} /></Field>
            <Field label={t("toCity")}><TextInput value={r.to_city} onChange={(e) => update({ to_city: e.target.value })} /></Field>
            <Field label={t("currency")} required><CurrencyPicker value={r.currency} onChange={(v) => update({ currency: v })} /></Field>
            <Field label={t("amount")} required><NumInput value={r.amount} onChange={(v) => update({ amount: v })} placeholder="0" /></Field>
            <Field label={t("fee")}><NumInput value={r.fee} onChange={(v) => update({ fee: v })} placeholder="0" /></Field>
            {isSend ? (
              <Field label={t("cashReceived")}><NumInput value={r.cash_amount} onChange={(v) => update({ cash_amount: v })} placeholder="0" /></Field>
            ) : (
              <Field label={t("secret")}><TextInput value={r.secret} onChange={(e) => update({ secret: e.target.value })} dir="ltr" /></Field>
            )}
            <Field label={t("paySafe")}><SafePicker value={r.safe_id} onChange={(v) => update({ safe_id: v })} showBalances /></Field>
            {isSend && (
              <Field label={t("secret")}><TextInput value={r.secret} onChange={(e) => update({ secret: e.target.value })} dir="ltr" /></Field>
            )}
            <Field label={t("note")} className="col-span-2"><TextInput value={r.note} onChange={(e) => update({ note: e.target.value })} /></Field>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
              <input type="checkbox" checked={r.pay_now} onChange={(e) => update({ pay_now: e.target.checked })} className="h-4 w-4 accent-emerald-600" />
              {t("payNow")}
            </label>
          </div>
        )}
      />

      {/* Pay dialog */}
      {payTarget && (
        <PayDialog
          hawala={payTarget}
          onClose={() => setPayTarget(null)}
          onPay={(safe_id) => doAction(payTarget.id, "pay", safe_id)}
        />
      )}

      <Confirm
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onYes={doDelete}
        danger
        message={`${t("confirmDelete")} (${confirm?.voucher})`}
      />
    </div>
  );
}

function PayDialog({ hawala, onClose, onPay }: { hawala: Hawala; onClose: () => void; onPay: (safe_id: number) => void }) {
  const { t, locale } = useLang();
  const [safe_id, setSafeId] = useState(hawala.safe_id || 0);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="mb-1 text-base font-bold">{t("markPaid")}</h3>
        <p className="mb-3 text-sm text-slate-500" dir="ltr">{hawala.voucher_no} • {formatMoney(hawala.amount, hawala.currency, locale)}</p>
        <Field label={t("paySafe")} required>
          <SafePicker value={safe_id} onChange={setSafeId} showBalances />
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <Btn variant="secondary" onClick={onClose}>{t("cancel")}</Btn>
          <Btn onClick={() => onPay(safe_id)} disabled={!safe_id}><CheckCircle2 size={16} /> {t("markPaid")}</Btn>
        </div>
      </div>
    </div>
  );
}
