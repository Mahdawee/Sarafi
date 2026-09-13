"use client";

import React, { useEffect, useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { todayISO } from "@/lib/format";
import type { CurrencyRate } from "@/lib/types";
import { Btn, Card, Confirm, Field, Modal, NumInput, PageHeader, Spinner, TextInput } from "@/components/ui";
import { useData, useToast } from "@/components/app-providers";

export default function SettingsPage() {
  const { t, locale } = useLang();
  const { toast } = useToast();
  const { refresh } = useData();

  const [settings, setSettings] = useState<Record<string, string>>({});
  const [currencies, setCurrencies] = useState<CurrencyRate[]>([]);
  const [rates, setRates] = useState<Record<string, { buy: string; sell: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [curModal, setCurModal] = useState(false);
  const [newCur, setNewCur] = useState({ code: "", name_fa: "", name_en: "", buy_rate: "", sell_rate: "" });
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetText, setResetText] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([
        apiGet<{ settings: Record<string, string> }>("/api/settings"),
        apiGet<{ currencies: CurrencyRate[] }>("/api/currencies"),
      ]);
      setSettings(s.settings);
      setCurrencies(c.currencies);
      const r: Record<string, { buy: string; sell: string }> = {};
      for (const cur of c.currencies) r[cur.code] = { buy: String(cur.buy_rate), sell: String(cur.sell_rate) };
      setRates(r);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await apiPut("/api/settings", settings);
      toast(t("saved"), "success");
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const saveRates = async () => {
    try {
      await apiPut("/api/currencies", {
        rates: Object.entries(rates).map(([code, v]) => ({
          code, buy_rate: parseFloat(v.buy) || 0, sell_rate: parseFloat(v.sell) || 0,
        })),
      });
      toast(t("ratesUpdated"), "success");
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"), "error");
    }
  };

  const addCurrency = async () => {
    if (!newCur.code.trim()) return;
    try {
      await apiPost("/api/currencies", {
        code: newCur.code.trim().toUpperCase(), name_fa: newCur.name_fa, name_en: newCur.name_en,
        buy_rate: parseFloat(newCur.buy_rate) || 0, sell_rate: parseFloat(newCur.sell_rate) || 0,
      });
      toast(t("saved"), "success");
      setCurModal(false);
      setNewCur({ code: "", name_fa: "", name_en: "", buy_rate: "", sell_rate: "" });
      load();
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"), "error");
    }
  };

  const downloadBackup = () => {
    window.open("/api/backup", "_blank");
  };

  const doReset = async () => {
    try {
      await fetch("/api/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: resetText }) });
      toast(t("deleted"), "success");
      setResetConfirm(false);
      setResetText("");
      load();
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"), "error");
    }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title={t("nav_settings")} />

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Company */}
        <Card title={t("companyInfo")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("companyFa")}><TextInput value={settings.company_fa ?? ""} onChange={(e) => setSettings({ ...settings, company_fa: e.target.value })} /></Field>
            <Field label={t("companyEn")}><TextInput value={settings.company_en ?? ""} onChange={(e) => setSettings({ ...settings, company_en: e.target.value })} /></Field>
            <Field label={t("phone")}><TextInput value={settings.phone ?? ""} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} dir="ltr" /></Field>
            <Field label={t("address")}><TextInput value={settings.address_fa ?? ""} onChange={(e) => setSettings({ ...settings, address_fa: e.target.value })} /></Field>
            <Field label={t("footerFa")}><TextInput value={settings.receipt_footer_fa ?? ""} onChange={(e) => setSettings({ ...settings, receipt_footer_fa: e.target.value })} /></Field>
            <Field label={t("footerEn")}><TextInput value={settings.receipt_footer_en ?? ""} onChange={(e) => setSettings({ ...settings, receipt_footer_en: e.target.value })} /></Field>
          </div>
          <div className="mt-3 flex justify-end">
            <Btn onClick={saveSettings} disabled={saving}>{saving ? t("saving") : t("save")}</Btn>
          </div>
        </Card>

        {/* Currencies */}
        <Card
          title={t("currencies")}
          action={<Btn variant="secondary" size="sm" onClick={() => setCurModal(true)}><Plus size={14} /> {t("newCurrency")}</Btn>}
        >
          <div className="space-y-2">
            {currencies.map((c) => (
              <div key={c.code} className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2 rounded-xl bg-slate-50 p-2">
                <div>
                  <div className="text-sm font-extrabold" dir="ltr">{c.code}</div>
                  <div className="text-[11px] text-slate-400">{locale === "fa" ? c.name_fa : c.name_en}</div>
                </div>
                {c.is_base ? (
                  <div className="col-span-2 text-center text-xs font-bold text-emerald-700">{t("baseCurrency")}</div>
                ) : (
                  <>
                    <Field label={t("buyRate")}><NumInput value={rates[c.code]?.buy ?? ""} onChange={(v) => setRates({ ...rates, [c.code]: { ...rates[c.code], buy: v } })} /></Field>
                    <Field label={t("sellRate")}><NumInput value={rates[c.code]?.sell ?? ""} onChange={(v) => setRates({ ...rates, [c.code]: { ...rates[c.code], sell: v } })} /></Field>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end">
            <Btn onClick={saveRates}>{t("updateRates")}</Btn>
          </div>
        </Card>

        {/* Backup */}
        <Card title={t("backup")}>
          <p className="mb-3 text-xs text-slate-500">{t("backupHint")}</p>
          <Btn variant="secondary" onClick={downloadBackup}><Download size={15} /> {t("downloadBackup")}</Btn>
        </Card>

        {/* Danger */}
        <Card title={t("dangerZone")}>
          <Btn variant="danger" onClick={() => setResetConfirm(true)}><Trash2 size={15} /> {t("resetData")}</Btn>
        </Card>
      </div>

      {/* New currency */}
      <Modal open={curModal} onClose={() => setCurModal(false)} title={t("newCurrency")}>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Field label={t("currencyCode")} required><TextInput value={newCur.code} onChange={(e) => setNewCur({ ...newCur, code: e.target.value.toUpperCase() })} dir="ltr" maxLength={5} /></Field>
            <Field label={t("buyRate")}><NumInput value={newCur.buy_rate} onChange={(v) => setNewCur({ ...newCur, buy_rate: v })} /></Field>
            <Field label={t("sellRate")}><NumInput value={newCur.sell_rate} onChange={(v) => setNewCur({ ...newCur, sell_rate: v })} /></Field>
          </div>
          <Field label={t("currencyNameFa")}><TextInput value={newCur.name_fa} onChange={(e) => setNewCur({ ...newCur, name_fa: e.target.value })} /></Field>
          <Field label={t("currencyNameEn")}><TextInput value={newCur.name_en} onChange={(e) => setNewCur({ ...newCur, name_en: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="secondary" onClick={() => setCurModal(false)}>{t("cancel")}</Btn>
            <Btn onClick={addCurrency}>{t("save")}</Btn>
          </div>
        </div>
      </Modal>

      {/* Reset */}
      <Modal open={resetConfirm} onClose={() => setResetConfirm(false)} title={t("resetData")}>
        <p className="text-sm font-semibold text-rose-600">{t("resetConfirm")}</p>
        <p className="mt-2 text-xs text-slate-500">{t("typeDelete")}</p>
        <TextInput value={resetText} onChange={(e) => setResetText(e.target.value)} dir="ltr" className="mt-2" placeholder="DELETE" />
        <div className="mt-4 flex justify-end gap-2">
          <Btn variant="secondary" onClick={() => setResetConfirm(false)}>{t("cancel")}</Btn>
          <Btn variant="danger" onClick={doReset} disabled={resetText !== "DELETE"}>{t("resetData")}</Btn>
        </div>
      </Modal>
    </div>
  );
}
