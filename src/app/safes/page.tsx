"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeftRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { formatDate, formatNumber, todayISO, parseNum } from "@/lib/format";
import type { Safe, SafeMovement, Transfer } from "@/lib/types";
import { Badge, Btn, Card, Confirm, DateInput, Empty, Field, Modal, NumInput, PageHeader, Select, Spinner, Tbl, TextInput } from "@/components/ui";
import { CurrencyPicker, SafePicker } from "@/components/pickers";
import MultiEntryModal from "@/components/MultiEntryModal";
import { PrintVoucherButton } from "@/components/PrintVoucher";
import { useData, useToast } from "@/components/app-providers";

interface TRow { date: string; from_safe: number; to_safe: number; currency: string; amount: string; description: string }
const blankT = (): TRow => ({ date: todayISO(), from_safe: 0, to_safe: 0, currency: "AFN", amount: "", description: "" });

export default function SafesPage() {
  const { t, locale } = useLang();
  const { toast } = useToast();
  const { refresh } = useData();

  const [safes, setSafes] = useState<Safe[]>([]);
  const [balances, setBalances] = useState<Record<number, Record<string, number>>>({});
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);

  const [safeModal, setSafeModal] = useState(false);
  const [editing, setEditing] = useState<Safe | null>(null);
  const [form, setForm] = useState({ name: "", type: "cash", account_no: "" });

  const [tModal, setTModal] = useState(false);
  const [tEntry, setTEntry] = useState<TRow[]>([blankT()]);
  const [submitting, setSubmitting] = useState(false);

  const [viewSafe, setViewSafe] = useState<Safe | null>(null);
  const [movements, setMovements] = useState<SafeMovement[]>([]);
  const [movLoading, setMovLoading] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "safe" | "transfer"; id: number; label: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, tr] = await Promise.all([
        apiGet<{ safes: Safe[]; balances: Record<number, Record<string, number>> }>("/api/safes"),
        apiGet<{ transfers: Transfer[] }>("/api/transfers"),
      ]);
      setSafes(s.safes);
      setBalances(s.balances);
      setTransfers(tr.transfers);
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"), "error");
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => { load(); }, [load]);

  const openView = async (s: Safe) => {
    setViewSafe(s);
    setMovLoading(true);
    try {
      const d = await apiGet<{ movements: SafeMovement[] }>(`/api/safes/${s.id}`);
      setMovements(d.movements);
    } finally {
      setMovLoading(false);
    }
  };

  const saveSafe = async () => {
    if (!form.name.trim()) { toast(t("fillRequired"), "error"); return; }
    try {
      if (editing) await apiPut(`/api/safes/${editing.id}`, form);
      else await apiPost("/api/safes", form);
      toast(t("saved"), "success");
      setSafeModal(false);
      setEditing(null);
      load();
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"), "error");
    }
  };

  const submitTransfer = async () => {
    for (const [i, r] of tEntry.entries()) {
      if (!r.from_safe || !r.to_safe || r.from_safe === r.to_safe || !r.currency || parseNum(r.amount) <= 0) {
        toast(`${t("row")} ${i + 1}: ${t("fillRequired")}`, "error");
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await apiPost<{ voucher_no: string }>("/api/transfers", {
        rows: tEntry.map((r) => ({ date: r.date, from_safe: r.from_safe, to_safe: r.to_safe, currency: r.currency, amount: parseNum(r.amount), description: r.description })),
      });
      toast(`${t("saved")} — ${res.voucher_no}`, "success");
      setTModal(false);
      setTEntry([blankT()]);
      load();
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const doDelete = async () => {
    if (!confirm) return;
    try {
      if (confirm.kind === "safe") await apiDelete(`/api/safes/${confirm.id}`);
      else await apiDelete(`/api/transfers/${confirm.id}`);
      toast(t("deleted"), "success");
      load();
      refresh();
      if (viewSafe && confirm.kind === "safe") setViewSafe(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"), "error");
    }
  };

  return (
    <div>
      <PageHeader
        title={t("nav_safes")}
        actions={
          <>
            <Btn variant="secondary" onClick={() => { setSafeModal(true); setEditing(null); setForm({ name: "", type: "cash", account_no: "" }); }}>
              <Plus size={16} /> {t("newSafe")}
            </Btn>
            <Btn onClick={() => { setTEntry([blankT()]); setTModal(true); }}><ArrowLeftRight size={16} /> {t("newTransfer")}</Btn>
          </>
        }
      />

      {loading ? <Spinner /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {safes.map((s) => (
            <Card key={s.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-extrabold text-slate-800">{s.name}</div>
                  <div className="mt-1"><Badge color={s.type === "cash" ? "green" : "blue"}>{s.type === "cash" ? t("safeTypeCash") : t("safeTypeBank")}</Badge></div>
                </div>
                <div className="flex gap-0.5">
                  <Btn variant="ghost" size="sm" onClick={() => { setEditing(s); setForm({ name: s.name, type: s.type, account_no: s.account_no }); setSafeModal(true); }}><Pencil size={15} /></Btn>
                  <Btn variant="ghost" size="sm" onClick={() => setConfirm({ kind: "safe", id: s.id, label: s.name })}><Trash2 size={15} className="text-rose-500" /></Btn>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(balances[s.id] ?? {}).length === 0 && <span className="text-xs text-slate-300">—</span>}
                {Object.entries(balances[s.id] ?? {}).map(([cur, b]) => (
                  <span key={cur} dir="ltr" className={`rounded-lg px-2 py-1 text-xs font-extrabold tabular-nums ${b < 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-800"}`}>
                    {cur} {formatNumber(b, locale)}
                  </span>
                ))}
              </div>
              <Btn variant="secondary" size="sm" className="mt-3 w-full" onClick={() => openView(s)}>{t("movements")}</Btn>
            </Card>
          ))}
        </div>
      )}

      {/* Transfers */}
      <h2 className="mb-2 mt-6 text-base font-extrabold text-slate-800">{t("transfer")}</h2>
      {transfers.length === 0 ? <Empty /> : (
        <Tbl head={[t("voucherNo"), t("date"), t("fromSafe"), t("toSafe"), t("amount"), t("description"), t("actions")]}>
          {transfers.map((x) => (
            <tr key={x.id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-bold text-slate-600" dir="ltr">{x.voucher_no}</td>
              <td className="whitespace-nowrap px-3 py-2 text-xs">{formatDate(x.date, locale)}</td>
              <td className="px-3 py-2 text-xs">{x.from_safe_name}</td>
              <td className="px-3 py-2 text-xs">{x.to_safe_name}</td>
              <td className="whitespace-nowrap px-3 py-2 text-xs font-extrabold" dir="ltr">{x.amount.toLocaleString()} {x.currency}</td>
              <td className="max-w-48 truncate px-3 py-2 text-xs text-slate-500">{x.description}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-0.5">
                  <PrintVoucherButton voucherNo={x.voucher_no} />
                  <Btn variant="ghost" size="sm" onClick={() => setConfirm({ kind: "transfer", id: x.id, label: x.voucher_no })}>
                    <Trash2 size={15} className="text-rose-500" />
                  </Btn>
                </div>
              </td>
            </tr>
          ))}
        </Tbl>
      )}

      {/* Safe modal */}
      <Modal open={safeModal} onClose={() => setSafeModal(false)} title={editing ? t("safeName") : t("newSafe")}>
        <div className="space-y-3">
          <Field label={t("safeName")} required><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("type")}>
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="cash">{t("safeTypeCash")}</option>
                <option value="bank">{t("safeTypeBank")}</option>
              </Select>
            </Field>
            <Field label={t("accountNo")}><TextInput value={form.account_no} onChange={(e) => setForm({ ...form, account_no: e.target.value })} dir="ltr" /></Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="secondary" onClick={() => setSafeModal(false)}>{t("cancel")}</Btn>
            <Btn onClick={saveSafe}>{t("save")}</Btn>
          </div>
        </div>
      </Modal>

      {/* Transfer multi-entry modal */}
      <MultiEntryModal
        open={tModal} onClose={() => setTModal(false)} title={t("newTransfer")}
        rows={tEntry} setRows={setTEntry} blankRow={blankT} submitting={submitting} onSubmit={submitTransfer}
        renderRow={(r, idx, update) => (
          <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-3">
            <Field label={t("date")} required><DateInput value={r.date} onChange={(e) => update({ date: e.target.value })} /></Field>
            <Field label={t("fromSafe")} required><SafePicker value={r.from_safe} onChange={(v) => update({ from_safe: v })} showBalances /></Field>
            <Field label={t("toSafe")} required><SafePicker value={r.to_safe} onChange={(v) => update({ to_safe: v })} showBalances /></Field>
            <Field label={t("currency")} required><CurrencyPicker value={r.currency} onChange={(v) => update({ currency: v })} /></Field>
            <Field label={t("amount")} required><NumInput value={r.amount} onChange={(v) => update({ amount: v })} placeholder="0" /></Field>
            <Field label={t("description")}><TextInput value={r.description} onChange={(e) => update({ description: e.target.value })} /></Field>
          </div>
        )}
      />

      {/* Movements modal */}
      <Modal open={!!viewSafe} onClose={() => setViewSafe(null)} title={`${t("movements")} — ${viewSafe?.name}`} wide>
        {movLoading ? <Spinner /> : movements.length === 0 ? <Empty /> : (
          <Tbl head={[t("date"), t("voucherNo"), t("description"), t("currency"), t("in"), t("out")]}>
            {movements.map((m) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap px-3 py-2 text-xs">{formatDate(m.date, locale)}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs" dir="ltr">{m.voucher_no}</td>
                <td className="max-w-56 truncate px-3 py-2 text-xs">{m.description}</td>
                <td className="px-3 py-2 text-xs font-bold" dir="ltr">{m.currency}</td>
                <td className="px-3 py-2 text-xs font-bold text-emerald-600" dir="ltr">{m.amount > 0 ? formatNumber(m.amount, locale) : "—"}</td>
                <td className="px-3 py-2 text-xs font-bold text-rose-600" dir="ltr">{m.amount < 0 ? formatNumber(-m.amount, locale) : "—"}</td>
              </tr>
            ))}
          </Tbl>
        )}
      </Modal>

      <Confirm open={!!confirm} onClose={() => setConfirm(null)} onYes={doDelete} danger
        message={`${t("confirmDelete")} (${confirm?.label})`} />
    </div>
  );
}
