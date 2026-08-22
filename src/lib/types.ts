// ─── Core data model shared by every module ────────────────────────────────
// The app persists this shape through src/lib/storage.ts. Swap that adapter
// for an API client without touching any UI code.

export type ID = string;

export interface Product {
  id: ID;
  name: string;
  image?: string; // data URL
  sku: string;
  barcode?: string;
  category: string;
  description?: string;
  supplierId?: ID | null;
  cost: number;
  price: number;
  stock: number;
  lowStockThreshold: number;
  status: "active" | "archived";
  sold: number;
  createdAt: string;
}

export interface Customer {
  id: ID;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  totalSpent: number;
  purchases: number;
  loyaltyPoints: number;
  storeCredit: number;
  createdAt: string;
}

export type Role = "cashier" | "manager" | "admin";

export interface Employee {
  id: ID;
  name: string;
  username: string;
  role: Role;
  pin: string;
  phone?: string;
  email?: string;
  status: "active" | "inactive";
  joinedAt: string;
}

export interface Supplier {
  id: ID;
  company: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  createdAt: string;
}

export interface PurchaseOrderItem {
  productId: ID;
  name: string;
  sku: string;
  qty: number;
  cost: number;
  receivedQty: number;
}

export interface PurchaseOrder {
  id: ID;
  poNumber: string;
  supplierId: ID;
  items: PurchaseOrderItem[];
  status: "draft" | "ordered" | "received" | "cancelled";
  paid?: boolean; // set once the supplier invoice has been settled
  paidAt?: string;
  notes?: string;
  createdAt: string;
  orderedAt?: string;
  receivedAt?: string;
  createdBy: string;
}

export interface TransactionItem {
  productId: ID;
  name: string;
  sku: string;
  price: number;
  cost: number;
  qty: number;
  lineDiscount: number;
  note?: string;
}

export type PaymentMethod = "cash" | "card" | "mobile" | "other";

export interface Transaction {
  id: ID;
  number: string;
  date: string;
  employeeId: ID;
  employeeName: string;
  customerId: ID | null;
  customerName?: string;
  items: TransactionItem[];
  subtotal: number;
  discount: number;
  promoNames: string[];
  pointsRedeemed: number;
  pointsEarned: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  change: number;
  source?: "pos" | "qr";
  qrOrderId?: ID;
  note?: string;
  status: "completed" | "refunded";
  refundedAt?: string;
}

export interface Promotion {
  id: ID;
  name: string;
  type: "percent" | "fixed" | "bogo";
  value: number;
  buyQty: number;
  getQty: number;
  scope: "order" | "category" | "product";
  targetId?: string;
  code?: string;
  minOrder: number;
  autoApply: boolean;
  startDate?: string;
  endDate?: string;
  active: boolean;
  description?: string;
}

export interface Expense {
  id: ID;
  name: string;
  category: string;
  amount: number;
  date: string;
  paymentMethod: PaymentMethod;
  notes?: string;
  receiptName?: string;
  receiptData?: string;
  createdAt: string;
}

export type StockReason = "sale" | "refund" | "adjustment" | "purchase" | "initial" | "qr-order" | "qr-release";

export interface QrCode {
  id: ID; // unguessable token embedded in the QR URL
  label: string; // e.g. "Table 12"
  active: boolean;
  createdAt: string;
  scans: number;
}

export type QrOrderStatus = "new" | "accepted" | "preparing" | "ready" | "completed" | "rejected" | "cancelled";

export interface QrOrder {
  id: ID;
  number: string; // ORD-####
  qrCodeId: ID | null;
  locationLabel?: string; // snapshot of the QR label at order time
  sessionId: ID; // anonymous customer session that placed it
  customerName?: string;
  customerPhone?: string;
  note?: string;
  items: TransactionItem[]; // same shape as POS line items (price/cost snapshots)
  subtotal: number;
  discount: number;
  promoNames: string[];
  tax: number;
  total: number;
  status: QrOrderStatus;
  createdAt: string;
  /** Last status transition — used by the server to merge concurrent edits. */
  updatedAt?: string;
  acceptedAt?: string;
  readyAt?: string;
  completedAt?: string;
  paymentMethod?: PaymentMethod;
  txnId?: ID; // linked transaction once completed
  handledBy?: string; // employee who accepted/completed
}

export interface QrOrderSettings {
  enabled: boolean;
  serviceMode: "counter" | "table"; // counter pickup vs brought to table
  allowName: boolean;
  allowPhone: boolean;
  allowNotes: boolean;
  soundEnabled: boolean;
  instructions: string; // printed under the QR poster + shown on the customer page
  publicBaseUrl?: string; // optional production address baked into printed QR codes (e.g. https://pos.mycafe.com)
}

export interface StockMovement {
  id: ID;
  date: string;
  productId: ID;
  productName: string;
  change: number;
  reason: StockReason;
  reference?: string;
  byEmployee?: string;
  resultingStock: number;
}

export interface AppNotification {
  id: ID;
  type: "low-stock" | "out-of-stock" | "po-received" | "po-pending" | "large-refund" | "qr-order" | "system";
  title: string;
  message: string;
  date: string;
  read: boolean;
  link?: string;
}

export interface ActivityEntry {
  id: ID;
  date: string;
  employeeId: ID | null;
  employeeName: string;
  type:
    | "login"
    | "logout"
    | "sale"
    | "refund"
    | "product"
    | "inventory"
    | "settings"
    | "employee"
    | "customer"
    | "supplier"
    | "purchase"
    | "promotion"
    | "expense"
    | "system";
  action: string;
  detail: string;
}

export interface LoyaltyLevel {
  name: string;
  threshold: number;
  perkPercent: number;
}

export interface LoyaltySettings {
  enabled: boolean;
  earnPerUnit: number;
  pointsPerUnit: number;
  levels: LoyaltyLevel[];
}

export interface Settings {
  businessName: string;
  logo?: string;
  address: string;
  phone: string;
  email: string;
  currencyCode: string;
  currencySymbol: string;
  taxEnabled: boolean;
  taxRate: number;
  receiptFooter: string;
  paymentMethods: Record<PaymentMethod, boolean>;
  theme: "light" | "dark";
  loyalty: LoyaltySettings;
  largeRefundThreshold: number;
  onboardingComplete: boolean;
  demoData: boolean;
  nextTxnNumber: number;
  nextPoNumber: number;
  nextQrNumber: number;
  qr: QrOrderSettings;
}

export interface CartLine {
  productId: ID;
  qty: number;
  note?: string;
}

export interface HeldSale {
  id: ID;
  date: string;
  customerId: ID | null;
  lines: CartLine[];
  note?: string;
}

export interface DB {
  version: number;
  products: Product[];
  customers: Customer[];
  employees: Employee[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  transactions: Transaction[];
  promotions: Promotion[];
  expenses: Expense[];
  notifications: AppNotification[];
  activityLog: ActivityEntry[];
  stockHistory: StockMovement[];
  heldSales: HeldSale[];
  qrCodes: QrCode[];
  qrOrders: QrOrder[];
  settings: Settings;
}

export const EXPENSE_CATEGORIES = [
  "Rent",
  "Utilities",
  "Salaries",
  "Supplies",
  "Repairs",
  "Marketing",
  "Other",
] as const;

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  mobile: "Mobile Payment",
  other: "Other",
};
