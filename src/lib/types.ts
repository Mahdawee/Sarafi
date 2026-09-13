// Shared TypeScript types for the Sarafi (money exchange) system

export type Locale = "fa" | "en";

export interface Customer {
  id: number;
  code: string;
  name: string;
  phone: string;
  address: string;
  father_name?: string;
  national_id?: string;
  email?: string;
  type: "customer" | "agent" | "staff" | "company";
  note: string;
  is_active: number;
  created_at: string;
}

export interface Safe {
  id: number;
  name: string;
  type: "cash" | "bank";
  account_no: string;
  is_active: number;
  created_at: string;
}

export interface CurrencyRate {
  code: string;
  name_fa: string;
  name_en: string;
  symbol: string;
  buy_rate: number;
  sell_rate: number;
  is_base: number;
  sort: number;
}

export type HawalaKind = "send" | "receive";
export type HawalaStatus = "pending" | "paid" | "cancelled";

export interface Hawala {
  id: number;
  voucher_no: string;
  kind: HawalaKind;
  date: string;
  sender_name: string;
  sender_phone: string;
  receiver_name: string;
  receiver_phone: string;
  from_city: string;
  to_city: string;
  customer_id: number;
  customer_name?: string;
  currency: string;
  amount: number;
  fee: number;
  cash_amount: number;
  safe_id: number;
  safe_name?: string;
  status: HawalaStatus;
  secret: string;
  note: string;
  created_at: string;
  paid_at: string;
  // Two-sided hawala information (compatible with the original currency/amount fields)
  sent_currency?: string;
  sent_amount?: number;
  received_currency?: string;
  received_amount?: number;
  exchange_rate?: number;
  from_account_type?: AccountType | "";
  from_account_id?: number;
  to_account_type?: AccountType | "";
  to_account_id?: number;
  received_commission?: number;
  paid_commission?: number;
  commission_currency?: string;
  payment_method?: "cash" | "account";
  verification_status?: "confirmed" | "pending";
  from_account_name?: string;
  to_account_name?: string;
}

export type ReceiptKind = "receive" | "pay";

export interface Receipt {
  id: number;
  voucher_no: string;
  kind: ReceiptKind;
  date: string;
  customer_id: number;
  customer_name?: string;
  safe_id: number;
  safe_name?: string;
  currency: string;
  amount: number;
  description: string;
  created_at: string;
}

export type DcKind = "debit" | "credit";

export interface DebitCredit {
  id: number;
  voucher_no: string;
  kind: DcKind;
  date: string;
  customer_id: number;
  customer_name?: string;
  currency: string;
  amount: number;
  reason: string;
  created_at: string;
}

export type ExchangeKind = "buy" | "sell";

export interface Exchange {
  id: number;
  voucher_no: string;
  kind: ExchangeKind;
  date: string;
  customer_id: number;
  customer_name?: string;
  foreign_currency: string;
  foreign_amount: number;
  rate: number;
  base_amount: number;
  safe_foreign: number;
  safe_foreign_name?: string;
  safe_base: number;
  safe_base_name?: string;
  profit: number;
  note: string;
  created_at: string;
}

export interface Expense {
  id: number;
  voucher_no: string;
  date: string;
  category: string;
  safe_id: number;
  safe_name?: string;
  currency: string;
  amount: number;
  description: string;
  created_at: string;
}

export interface Transfer {
  id: number;
  voucher_no: string;
  date: string;
  from_safe: number;
  from_safe_name?: string;
  to_safe: number;
  to_safe_name?: string;
  currency: string;
  amount: number;
  description: string;
  created_at: string;
}

export interface LedgerEntry {
  id: number;
  voucher_no: string;
  date: string;
  customer_id: number;
  currency: string;
  debit: number;
  credit: number;
  description: string;
  ref_type: string;
  ref_id: number;
  created_at: string;
}

export interface SafeMovement {
  id: number;
  voucher_no: string;
  date: string;
  safe_id: number;
  currency: string;
  amount: number;
  description: string;
  ref_type: string;
  ref_id: number;
  created_at: string;
}

export type AccountType = "customer" | "safe";

export interface AccountRef {
  type: AccountType;
  id: number;
}

export interface JournalEntry {
  id: number;
  voucher_no: string;
  date: string;
  debit_account_type: AccountType;
  debit_account_id: number;
  debit_account_name?: string;
  credit_account_type: AccountType;
  credit_account_id: number;
  credit_account_name?: string;
  currency: string;
  amount: number;
  description: string;
  is_commission: number;
  is_suspicious: number;
  created_at: string;
}

export interface TrialBalanceRow {
  account_type: AccountType;
  account_id: number;
  code: string;
  name: string;
  detail_type: string;
  currency: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface DashboardData {
  safes: { id: number; name: string; type: string; balances: Record<string, number> }[];
  rates: CurrencyRate[];
  today: {
    date: string;
    send_count: number; send_total_afn: number;
    receive_count: number; receive_total_afn: number;
    receipts_in_afn: number; receipts_out_afn: number;
    expenses_afn: number;
    fees_afn: number;
  };
  day_currency_totals: Record<string, { sent: number; received: number; cash_in: number; cash_out: number; fees: number }>;
  pending: { send: Hawala[]; receive: Hawala[] };
  recent: { voucher_no: string; date: string; type: string; label: string; amount: number; currency: string }[];
  customerTotals: Record<string, { debit: number; credit: number }>;
}

export interface CustomerStatement {
  customer: Customer;
  entries: LedgerEntry[];
  totals: Record<string, { debit: number; credit: number; balance: number }>;
}

export interface ProfitReport {
  from: string;
  to: string;
  hawala_fees: number;
  paid_commissions: number;
  exchange_profit: number;
  expenses: number;
  net: number;
  by_currency: Record<string, { fees: number; paid_commission: number; exchange: number; expenses: number }>;
}
