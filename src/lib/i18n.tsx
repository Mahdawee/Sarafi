"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { Locale } from "./types";

const dict = {
  // ── Navigation ──
  appName: { fa: "سیستم صرافی", en: "Sarafi System" },
  nav_dashboard: { fa: "داشبورد", en: "Dashboard" },
  nav_journal: { fa: "روزنامه", en: "Journal" },
  nav_balance_sheet: { fa: "ترازنامه", en: "Trial Balance" },
  nav_hawala_send: { fa: "حواله‌های ارسالی", en: "Sent Hawala" },
  nav_hawala_receive: { fa: "حواله‌های دریافتی", en: "Received Hawala" },
  nav_receipts: { fa: "رسیدها", en: "Receipts" },
  nav_debit_credit: { fa: "دبت / کردت", en: "Debit / Credit" },
  nav_exchange: { fa: "خرید و فروش ارز", en: "Currency Exchange" },
  nav_customers: { fa: "مشتریان", en: "Customers" },
  nav_safes: { fa: "صندوق‌ها", en: "Safes & Banks" },
  nav_expenses: { fa: "مصارف", en: "Expenses" },
  nav_reports: { fa: "گزارشات", en: "Reports" },
  nav_settings: { fa: "تنظیمات", en: "Settings" },
  nav_group_operations: { fa: "ثبت معامله", en: "Transactions" },
  nav_group_accounts: { fa: "حساب‌ها", en: "Accounts" },
  nav_group_hawala: { fa: "مدیریت حواله", en: "Hawala" },
  nav_group_finance: { fa: "مالی و گزارشات", en: "Finance & Reports" },
  nav_group_system: { fa: "سیستم", en: "System" },

  // ── Common ──
  save: { fa: "ثبت", en: "Save" },
  cancel: { fa: "انصراف", en: "Cancel" },
  close: { fa: "بستن", en: "Close" },
  edit: { fa: "ویرایش", en: "Edit" },
  delete: { fa: "حذف", en: "Delete" },
  add: { fa: "افزودن", en: "Add" },
  addRow: { fa: "＋ افزودن سطر", en: "＋ Add Row" },
  new: { fa: "جدید", en: "New" },
  search: { fa: "جستجو...", en: "Search..." },
  date: { fa: "تاریخ", en: "Date" },
  from: { fa: "از", en: "From" },
  to: { fa: "تا", en: "To" },
  description: { fa: "شرح", en: "Description" },
  amount: { fa: "مبلغ", en: "Amount" },
  currency: { fa: "ارز", en: "Currency" },
  total: { fa: "جمع کل", en: "Total" },
  row: { fa: "ردیف", en: "#" },
  actions: { fa: "عملیات", en: "Actions" },
  status: { fa: "وضعیت", en: "Status" },
  print: { fa: "چاپ", en: "Print" },
  voucherNo: { fa: "نمبر سند", en: "Voucher No" },
  customer: { fa: "مشتری / طرف حساب", en: "Customer / Account" },
  safe: { fa: "صندوق", en: "Safe" },
  selectCustomer: { fa: "انتخاب مشتری...", en: "Select customer..." },
  selectSafe: { fa: "انتخاب صندوق...", en: "Select safe..." },
  noData: { fa: "رکوردی یافت نشد", en: "No records found" },
  confirmDelete: { fa: "آیا از حذف این رکورد مطمئن هستید؟", en: "Are you sure you want to delete this record?" },
  confirmDeleteVoucher: { fa: "کل سند و تمام سطرهای آن حذف شود؟", en: "Delete the whole voucher with all its rows?" },
  yes: { fa: "بله", en: "Yes" },
  no: { fa: "خیر", en: "No" },
  loading: { fa: "در حال بارگذاری...", en: "Loading..." },
  saving: { fa: "در حال ثبت...", en: "Saving..." },
  saved: { fa: "با موفقیت ثبت شد", en: "Saved successfully" },
  deleted: { fa: "حذف شد", en: "Deleted" },
  error: { fa: "خطا رخ داد", en: "An error occurred" },
  fillRequired: { fa: "لطفاً تمام فیلدهای ضروری را تکمیل کنید", en: "Please fill all required fields" },
  today: { fa: "امروز", en: "Today" },
  note: { fa: "یادداشت", en: "Note" },
  phone: { fa: "تلفن", en: "Phone" },
  address: { fa: "آدرس", en: "Address" },
  email: { fa: "ایمیل", en: "Email" },
  fatherName: { fa: "نام پدر", en: "Father name" },
  nationalId: { fa: "نمبر تذکره", en: "National ID" },
  name: { fa: "نام", en: "Name" },
  type: { fa: "نوع", en: "Type" },
  balance: { fa: "بیلانس", en: "Balance" },
  debit: { fa: "دبت", en: "Debit" },
  credit: { fa: "کردت", en: "Credit" },
  debtor: { fa: "بدهکار", en: "Debtor" },
  creditor: { fa: "بستانکار", en: "Creditor" },
  settled: { fa: "تسویه", en: "Settled" },
  all: { fa: "همه", en: "All" },
  filter: { fa: "فلتر", en: "Filter" },
  export: { fa: "خروجی", en: "Export" },
  refresh: { fa: "تازه‌سازی", en: "Refresh" },
  account: { fa: "حساب", en: "Account" },
  fromAccount: { fa: "از حساب", en: "From account" },
  toAccount: { fa: "به حساب", en: "To account" },
  debitAccount: { fa: "حساب دبت", en: "Debit account" },
  creditAccount: { fa: "حساب کردت", en: "Credit account" },
  transaction: { fa: "معامله", en: "Transaction" },
  quickEntry: { fa: "ثبت سریع", en: "Quick entry" },
  quickEntryHint: { fa: "نوع معامله را انتخاب کنید", en: "Choose a transaction type" },
  reference: { fa: "مرجع", en: "Reference" },
  confirmed: { fa: "تأیید شده", en: "Confirmed" },
  cash: { fa: "نقد", en: "Cash" },
  onAccount: { fa: "حسابی", en: "On account" },
  suspicious: { fa: "مشکوک", en: "Suspicious" },
  commissionRelated: { fa: "مربوط کمیشن", en: "Commission related" },

  // ── Dashboard ──
  welcome: { fa: "خلاصه وضعیت صرافی", en: "Exchange overview" },
  safeBalances: { fa: "موجودی صندوق‌ها", en: "Safe Balances" },
  todayStats: { fa: "آمار امروز", en: "Today's Stats" },
  pendingHawala: { fa: "حواله‌های در انتظار", en: "Pending Hawala" },
  recentVouchers: { fa: "آخرین اسناد", en: "Recent Vouchers" },
  exchangeRates: { fa: "نرخ ارز", en: "Exchange Rates" },
  buyRate: { fa: "خرید", en: "Buy" },
  sellRate: { fa: "فروش", en: "Sell" },
  sentToday: { fa: "ارسالی امروز", en: "Sent today" },
  receivedToday: { fa: "دریافتی امروز", en: "Received today" },
  cashInToday: { fa: "دریافت نقدی امروز", en: "Cash in today" },
  cashOutToday: { fa: "پرداخت امروز", en: "Paid today" },
  expensesToday: { fa: "مصارف امروز", en: "Expenses today" },
  feesToday: { fa: "کمیشن امروز", en: "Fees today" },
  customerDebts: { fa: "بدهی/طلب مشتریان (مجموع به افغانی)", en: "Customer debts (total in AFN)" },
  totalDebtors: { fa: "مجموع بدهکاری مشتریان", en: "Total customer debts" },
  totalCreditors: { fa: "مجموع بستانکاری مشتریان", en: "Total customer credits" },
  inAfn: { fa: "معادل افغانی", en: "AFN equiv." },
  quickActions: { fa: "دسترسی سریع", en: "Quick Actions" },

  // ── Hawala ──
  newSendHawala: { fa: "حواله ارسالی جدید", en: "New Sent Hawala" },
  newReceiveHawala: { fa: "حواله دریافتی جدید", en: "New Received Hawala" },
  multiHint: { fa: "می‌توانید چندین سطر اضافه کنید و همه را یکجا با دکمه «ثبت» ذخیره نمایید.", en: "You can add multiple rows and save them all at once with the “Save” button." },
  sender: { fa: "فرستنده", en: "Sender" },
  senderName: { fa: "نام فرستنده", en: "Sender name" },
  senderPhone: { fa: "تلفن فرستنده", en: "Sender phone" },
  receiver: { fa: "گیرنده", en: "Receiver" },
  receiverName: { fa: "نام گیرنده", en: "Receiver name" },
  receiverPhone: { fa: "تلفن گیرنده", en: "Receiver phone" },
  fromCity: { fa: "از شهر", en: "From city" },
  toCity: { fa: "به شهر", en: "To city" },
  fee: { fa: "کمیشن / فیس", en: "Fee" },
  cashReceived: { fa: "نقد دریافتی از مشتری", en: "Cash received from customer" },
  paySafe: { fa: "صندوق پرداخت", en: "Paying safe" },
  secret: { fa: "رمز حواله", en: "Hawala code" },
  pending: { fa: "در انتظار", en: "Pending" },
  paid: { fa: "پرداخت شده", en: "Paid" },
  cancelled: { fa: "لغو شده", en: "Cancelled" },
  markPaid: { fa: "تأیید پرداخت", en: "Mark as paid" },
  markUnpaid: { fa: "برگرداندن به انتظار", en: "Back to pending" },
  hawalaReceipt: { fa: "رسید حواله", en: "Hawala Receipt" },
  sendHawala: { fa: "حواله ارسالی", en: "Sent Hawala" },
  receiveHawala: { fa: "حواله دریافتی", en: "Received Hawala" },
  payNow: { fa: "پرداخت همزمان از صندوق", en: "Pay now from safe" },
  totalWithFee: { fa: "جمع با کمیشن", en: "Total with fee" },
  sentAmount: { fa: "مبلغ ارسالی", en: "Sent amount" },
  receivedAmount: { fa: "مبلغ دریافتی", en: "Received amount" },
  sentCurrency: { fa: "واحد پول ارسالی", en: "Sent currency" },
  receivedCurrency: { fa: "واحد پول دریافتی", en: "Received currency" },
  exchangeRate: { fa: "نرخ تبادله", en: "Exchange rate" },
  receivedCommission: { fa: "کمیشن دریافتی", en: "Commission received" },
  paidCommission: { fa: "کمیشن پرداختی", en: "Commission paid" },
  paymentMethod: { fa: "نحوه پرداخت", en: "Payment method" },
  verification: { fa: "وضعیت تأیید", en: "Verification" },
  hawalaAmounts: { fa: "مبالغ حواله", en: "Hawala amounts" },
  hawalaAccounts: { fa: "حساب‌های حواله", en: "Hawala accounts" },
  hawalaParties: { fa: "معلومات فرستنده و گیرنده", en: "Sender & receiver details" },

  // ── Receipts ──
  newReceipt: { fa: "رسید جدید", en: "New Receipt" },
  receiveReceipt: { fa: "رسید دریافت", en: "Cash Receipt" },
  payReceipt: { fa: "رسید پرداخت", en: "Payment Receipt" },
  receiptTitle: { fa: "رسید", en: "Receipt" },
  receivedFrom: { fa: "دریافت از", en: "Received from" },
  paidTo: { fa: "پرداخت به", en: "Paid to" },

  // ── Debit / Credit ──
  newDc: { fa: "سند دبت / کردت جدید", en: "New Debit / Credit" },
  debitNote: { fa: "دبت (بدهکار کردن مشتری)", en: "Debit (charge customer)" },
  creditNote: { fa: "کردت (بستانکار کردن مشتری)", en: "Credit (pay customer)" },
  reason: { fa: "بابت", en: "Reason" },

  // ── Exchange ──
  newExchange: { fa: "معامله جدید ارز", en: "New Exchange Deal" },
  buyCurrency: { fa: "خرید ارز", en: "Buy Currency" },
  sellCurrency: { fa: "فروش ارز", en: "Sell Currency" },
  foreignCurrency: { fa: "ارز خارجی", en: "Foreign currency" },
  foreignAmount: { fa: "مبلغ ارز", en: "Foreign amount" },
  rate: { fa: "نرخ", en: "Rate" },
  baseAmount: { fa: "مبلغ افغانی", en: "AFN amount" },
  foreignSafe: { fa: "صندوق ارز", en: "Currency safe" },
  baseSafe: { fa: "صندوق افغانی", en: "AFN safe" },
  profit: { fa: "مفاد", en: "Profit" },
  loss: { fa: "ضرر", en: "Loss" },
  optionalCustomer: { fa: "مشتری (اختیاری — اگر نسیه است)", en: "Customer (optional — if on account)" },

  // ── Customers ──
  newCustomer: { fa: "مشتری جدید", en: "New Customer" },
  editCustomer: { fa: "ویرایش مشتری", en: "Edit Customer" },
  customerCode: { fa: "کد", en: "Code" },
  customerType: { fa: "نوع حساب", en: "Account type" },
  type_customer: { fa: "مشتری", en: "Customer" },
  type_agent: { fa: "صراف / نماینده", en: "Agent" },
  type_staff: { fa: "کارمند", en: "Staff" },
  type_company: { fa: "شرکت", en: "Company" },
  statement: { fa: "صورت حساب", en: "Statement" },
  viewStatement: { fa: "مشاهده صورت حساب", en: "View statement" },
  openingBalance: { fa: "بیلانس ابتدایی", en: "Opening balance" },
  openingDebit: { fa: "دبت ابتدایی", en: "Opening debit" },
  openingCredit: { fa: "کردت ابتدایی", en: "Opening credit" },

  // ── Safes ──
  newSafe: { fa: "صندوق جدید", en: "New Safe" },
  safeName: { fa: "نام صندوق", en: "Safe name" },
  safeTypeCash: { fa: "نقدی", en: "Cash" },
  safeTypeBank: { fa: "بانکی", en: "Bank" },
  accountNo: { fa: "نمبر حساب", en: "Account no" },
  movements: { fa: "گردش صندوق", en: "Movements" },
  transfer: { fa: "انتقال بین صندوق‌ها", en: "Transfer Between Safes" },
  newTransfer: { fa: "انتقال جدید", en: "New Transfer" },
  fromSafe: { fa: "از صندوق", en: "From safe" },
  toSafe: { fa: "به صندوق", en: "To safe" },
  in: { fa: "ورودی", en: "In" },
  out: { fa: "خروجی", en: "Out" },

  // ── Expenses ──
  newExpense: { fa: "مصرف جدید", en: "New Expense" },
  category: { fa: "کتگوری", en: "Category" },
  cat_rent: { fa: "کرایه", en: "Rent" },
  cat_salary: { fa: "معاش", en: "Salary" },
  cat_food: { fa: "غذا", en: "Food" },
  cat_transport: { fa: "ترانسپورت", en: "Transport" },
  cat_utility: { fa: "برق / آب / اینترنت", en: "Utilities" },
  cat_other: { fa: "متفرقه", en: "Other" },

  // ── Journal and balance sheet ──
  journal: { fa: "دفتر روزنامه", en: "General Journal" },
  newJournal: { fa: "ثبت روزنامه جدید", en: "New journal entry" },
  journalHint: { fa: "هر سطر یک دبت و یک کردت هم‌مبلغ است؛ چند سطر را در یک سند ثبت کنید.", en: "Each line posts an equal debit and credit; save multiple lines in one voucher." },
  journalEntry: { fa: "ثبت روزنامه", en: "Journal entry" },
  trialBalance: { fa: "تراز آزمایشی", en: "Trial balance" },
  trialBalanceHint: { fa: "مانده تمام حساب‌ها تا تاریخ انتخاب‌شده، بدون مخلوط کردن ارزها.", en: "All account balances as of the selected date, kept in their original currencies." },
  accountType: { fa: "نوع حساب", en: "Account type" },
  accountCustomer: { fa: "مشتری / نماینده", en: "Customer / agent" },
  accountSafe: { fa: "صندوق / بانک", en: "Safe / bank" },
  balanceSide: { fa: "مانده", en: "Balance" },
  asOfDate: { fa: "تا تاریخ", en: "As of date" },
  debitTotal: { fa: "مجموع دبت", en: "Total debit" },
  creditTotal: { fa: "مجموع کردت", en: "Total credit" },

  // ── Reports ──
  dailyReport: { fa: "گزارش روزانه", en: "Daily Report" },
  profitReport: { fa: "گزارش مفاد و ضرر", en: "Profit & Loss" },
  customerReport: { fa: "گزارش مشتریان", en: "Customer Report" },
  hawalaReport: { fa: "گزارش حواله‌ها", en: "Hawala Report" },
  totalFees: { fa: "مجموع کمیشن حواله‌ها", en: "Total hawala fees" },
  totalExchangeProfit: { fa: "مجموع مفاد ارز", en: "Total exchange profit" },
  paidCommissions: { fa: "مجموع کمیشن پرداختی", en: "Paid commissions" },
  totalExpenses: { fa: "مجموع مصارف", en: "Total expenses" },
  netProfit: { fa: "مفاد خالص", en: "Net profit" },
  dateRange: { fa: "محدوده تاریخ", en: "Date range" },
  showReport: { fa: "نمایش گزارش", en: "Show Report" },

  // ── Settings ──
  companyInfo: { fa: "معلومات شرکت", en: "Company Info" },
  companyFa: { fa: "نام شرکت (دری)", en: "Company name (Dari)" },
  companyEn: { fa: "نام شرکت (انگلیسی)", en: "Company name (English)" },
  footerFa: { fa: "متن پایین رسید (دری)", en: "Receipt footer (Dari)" },
  footerEn: { fa: "نام شرکت (انگلیسی)", en: "Receipt footer (English)" },
  currencies: { fa: "ارزها و نرخ‌ها", en: "Currencies & Rates" },
  currencyCode: { fa: "کد ارز", en: "Code" },
  currencyNameFa: { fa: "نام (دری)", en: "Name (Dari)" },
  currencyNameEn: { fa: "نام (انگلیسی)", en: "Name (English)" },
  baseCurrency: { fa: "ارز پایه", en: "Base currency" },
  updateRates: { fa: "ثبت نرخ‌های جدید", en: "Update Rates" },
  ratesUpdated: { fa: "نرخ‌ها ثبت شد", en: "Rates updated" },
  newCurrency: { fa: "ارز جدید", en: "New Currency" },
  backup: { fa: "بکاپ و بازیابی", en: "Backup & Restore" },
  downloadBackup: { fa: "دانلود بکاپ", en: "Download Backup" },
  backupHint: { fa: "از تمام معلومات سیستم یک فایل بکاپ دانلود می‌شود.", en: "Downloads a backup file of all system data." },
  language: { fa: "زبان", en: "Language" },
  dangerZone: { fa: "ناحیه خطر", en: "Danger Zone" },
  resetData: { fa: "حذف تمام معلومات", en: "Erase All Data" },
  resetConfirm: { fa: "تمام معلومات سیستم برای همیشه حذف می‌شود! مطمئن هستید؟", en: "ALL system data will be erased forever! Are you sure?" },
  typeDelete: { fa: "برای تأیید کلمه DELETE را تایپ کنید", en: "Type DELETE to confirm" },
} as const;

export type DictKey = keyof typeof dict;

interface LangCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (k: DictKey) => string;
}

const LanguageContext = createContext<LangCtx>({
  locale: "fa",
  setLocale: () => {},
  t: (k) => dict[k].fa,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("fa");

  useEffect(() => {
    // Defer the persisted preference read until after hydration. This preserves
    // the server's Dari first paint and avoids a synchronous effect render.
    const timer = window.setTimeout(() => {
      const saved = localStorage.getItem("sarafi-lang");
      if (saved === "en" || saved === "fa") setLocaleState(saved);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "fa" ? "fa" : "en";
    document.documentElement.dir = locale === "fa" ? "rtl" : "ltr";
    localStorage.setItem("sarafi-lang", locale);
  }, [locale]);

  const setLocale = (l: Locale) => setLocaleState(l);
  const t = (k: DictKey) => dict[k][locale] ?? dict[k].en;

  return <LanguageContext.Provider value={{ locale, setLocale, t }}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  return useContext(LanguageContext);
}
