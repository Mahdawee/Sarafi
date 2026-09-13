# Sarafi — سیستم مدیریت صرافی / Money Exchange Management System

A complete bilingual (Dari/Farsi + English) money-exchange (Sarafi/Hawala) management system built with **Next.js 16**, **React 19**, **Tailwind CSS 4** and **SQLite**.

## Features — امکانات

- 📊 **Dashboard** — safe balances, today's stats, pending hawala, live rates (داشبورد)
- 📤📥 **Send / Receive Hawala** — multi-row entry popup, pay/unpay/cancel, printable receipts (حواله ارسالی/دریافتی)
- 🧾 **Receipts (Received/Pay entries)** — multi-row popup, one Save button (رسید دریافت/پرداخت چندسطره)
- 📒 **Debit / Credit notes** — multi-row popup, one Save button (دبت/کردت چندسطره)
- 💱 **Currency Exchange** — buy/sell with automatic profit calc (خرید/فروش ارز)
- 👥 **Customers** — agents/staff/company accounts, full statements per currency (مشتریان + صورت حساب)
- 🏦 **Safes & Banks** — multi-currency balances, movements, transfers (صندوق‌ها + انتقالات)
- 💸 **Expenses** — categorized expenses (مصارف)
- 📈 **Reports** — profit & loss, daily report (گزارش مفاد/ضرر + گزارش روزانه)
- ⚙️ **Settings** — company info, currencies & rates, backup (JSON), data reset (تنظیمات + بکاپ)
- 🖨️ **Print** — every voucher prints as a clean receipt (چاپ رسید)
- 🌍 **Bilingual + RTL** — Dari (شمسی/Jalali dates, Persian digits) and English

### Multi-entry popups (ورود چندگانه)
Send Hawala, Receive Hawala, Receipts, Debit/Credit (plus Exchange, Expenses, Transfers) all support
adding **multiple rows in one popup** and saving everything with a **single ثبت (Save) button** —
all rows share one voucher number (e.g. `HS-000001`).

## Quick start

```bash
npm install
npm run dev      # → http://localhost:3000
```

Data is stored in `data/sarafi.db` (SQLite, auto-created). Backup anytime from **Settings → Download Backup**.

## Build for production

```bash
npm run build
npm start
```

## Tech

Next.js App Router · TypeScript · Tailwind 4 · better-sqlite3 · Vazirmatn font · jalaali-js
