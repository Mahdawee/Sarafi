"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import type { Customer } from "@/lib/types";
import { Badge, Btn, Confirm, Empty, Field, Modal, PageHeader, SearchBox, Select, Spinner, Tbl, TextInput } from "@/components/ui";
import { useData, useToast } from "@/components/app-providers";

interface Bal { debit: number; credit: number; balance: number }

export default function CustomersPage() {
  const { t, locale } = useLang();
  const { toast } = useToast();
  const { refresh } = useData();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [balances, setBalances] = useState<Record<number, Record<string, Bal>>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "", type: "customer", note: "" });
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<Customer | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = q ? `?q=${encodeURIComponent(q)}` : "";
      const d = await apiGet<{ customers: Customer[]; balances: Record<number, Record<string, Bal>> }>(`/api/customers${sp}`);
      setCustomers(d.customers);
      setBalances(d.balances);
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"), "error");
    } finally {
      setLoading(false);
    }
  }, [q, toast, t]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", phone: "", address: "", type: "customer", note: "" });
    setModal(true);
  };
  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone, address: c.address, type: c.type, note: c.note });
    setModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast(t("fillRequired"), "error"); return; }
    setSaving(true);
    try {
      if (editing) await apiPut(`/api/customers/${editing.id}`, form);
      else await apiPost("/api/customers", form);
      toast(t("saved"), "success");
      setModal(false);
      load();
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!confirm) return;
    try {
      await apiDelete(`/api/customers/${confirm.id}`);
      toast(t("deleted"), "success");
      load();
      refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("error");
      toast(msg === "HAS_TRANSACTIONS" ? (locale === "fa" ? "این مشتری سند حساب دارد و حذف نمی‌شود" : "Customer has transactions and cannot be deleted") : msg, "error");
    }
  };

  const typeBadge = (ty: string) => {
    const map: Record<string, "blue" | "purple" | "gray" | "amber"> = { customer: "blue", agent: "purple", staff: "gray", company: "amber" };
    const label = ty === "agent" ? t("type_agent") : ty === "staff" ? t("type_staff") : ty === "company" ? t("type_company") : t("type_customer");
    return <Badge color={map[ty] ?? "gray"}>{label}</Badge>;
  };

  return (
    <div>
      <PageHeader title={t("nav_customers")} actions={<Btn onClick={openAdd}><Plus size={16} /> {t("newCustomer")}</Btn>} />
      <div className="mb-3"><SearchBox value={q} onChange={setQ} className="max-w-md" /></div>

      {loading ? <Spinner /> : customers.length === 0 ? <Empty /> : (
        <Tbl head={[t("customerCode"), t("name"), t("phone"), t("customerType"), t("balance"), t("actions")]}>
          {customers.map((c) => {
            const bals = balances[c.id] ?? {};
            const entries = Object.entries(bals).filter(([, b]) => b.balance !== 0);
            return (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-500" dir="ltr">{c.code}</td>
                <td className="whitespace-nowrap px-3 py-2 font-bold text-slate-700">{c.name}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs" dir="ltr">{c.phone || "—"}</td>
                <td className="px-3 py-2">{typeBadge(c.type)}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {entries.length === 0 && <span className="text-xs text-slate-300">—</span>}
                    {entries.map(([cur, b]) => (
                      <span key={cur} dir="ltr" title={b.balance > 0 ? t("creditor") : t("debtor")}
                        className={`rounded-lg px-2 py-0.5 text-[11px] font-extrabold tabular-nums ${b.balance > 0 ? "bg-blue-100 text-blue-800" : "bg-rose-100 text-rose-700"}`}>
                        {cur} {formatNumber(b.balance, locale)}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-0.5">
                    <Link href={`/customers/${c.id}`} title={t("statement")}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                      <FileText size={16} />
                    </Link>
                    <Btn variant="ghost" size="sm" title={t("edit")} onClick={() => openEdit(c)}><Pencil size={15} /></Btn>
                    <Btn variant="ghost" size="sm" title={t("delete")} onClick={() => setConfirm(c)}><Trash2 size={15} className="text-rose-500" /></Btn>
                  </div>
                </td>
              </tr>
            );
          })}
        </Tbl>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? t("editCustomer") : t("newCustomer")}>
        <div className="space-y-3">
          <Field label={t("name")} required><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("phone")}><TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" /></Field>
            <Field label={t("customerType")}>
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="customer">{t("type_customer")}</option>
                <option value="agent">{t("type_agent")}</option>
                <option value="staff">{t("type_staff")}</option>
                <option value="company">{t("type_company")}</option>
              </Select>
            </Field>
          </div>
          <Field label={t("address")}><TextInput value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <Field label={t("note")}><TextInput value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="secondary" onClick={() => setModal(false)}>{t("cancel")}</Btn>
            <Btn onClick={save} disabled={saving}>{saving ? t("saving") : t("save")}</Btn>
          </div>
        </div>
      </Modal>

      <Confirm open={!!confirm} onClose={() => setConfirm(null)} onYes={doDelete} danger
        message={`${t("confirmDelete")} (${confirm?.name})`} />
    </div>
  );
}
