import type { Role } from "./types";

// Human-friendly capability model. Roles map to plain-language abilities;
// the UI hides anything a role can't do so users never hit dead ends.
export interface Permissions {
  pos: boolean;
  viewTransactions: "all" | "own";
  refund: boolean;
  manageProducts: boolean;
  manageInventory: boolean;
  manageCustomers: boolean;
  manageSuppliers: boolean;
  managePurchases: boolean;
  managePromotions: boolean;
  manageExpenses: boolean;
  manageQr: boolean; // QR ordering: codes, settings, handling customer orders
  viewReports: boolean;
  manageEmployees: boolean;
  viewActivityLog: boolean;
  manageSettings: boolean;
  maxDiscountPercent: number; // manual discount cap per sale
}

const ALL: Permissions = {
  pos: true,
  viewTransactions: "all",
  refund: true,
  manageProducts: true,
  manageInventory: true,
  manageCustomers: true,
  manageSuppliers: true,
  managePurchases: true,
  managePromotions: true,
  manageExpenses: true,
  manageQr: true,
  viewReports: true,
  manageEmployees: true,
  viewActivityLog: true,
  manageSettings: true,
  maxDiscountPercent: 100,
};

const MANAGER: Permissions = {
  ...ALL,
  manageEmployees: false,
  manageSettings: false,
  maxDiscountPercent: 30,
};

const CASHIER: Permissions = {
  pos: true,
  viewTransactions: "own",
  refund: false,
  manageProducts: false,
  manageInventory: false,
  manageCustomers: true,
  manageSuppliers: false,
  managePurchases: false,
  managePromotions: false,
  manageExpenses: false,
  manageQr: false,
  viewReports: false,
  manageEmployees: false,
  viewActivityLog: false,
  manageSettings: false,
  maxDiscountPercent: 10,
};

export const ROLE_PERMISSIONS: Record<Role, Permissions> = {
  admin: ALL,
  manager: MANAGER,
  cashier: CASHIER,
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Owner / Admin",
  manager: "Manager",
  cashier: "Cashier",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  cashier: "Makes sales and serves customers. Cannot change prices or settings.",
  manager: "Runs daily operations: inventory, refunds, products and reports.",
  admin: "Full access to everything, including employees and settings.",
};
