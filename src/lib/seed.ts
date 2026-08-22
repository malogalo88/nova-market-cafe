import type {
  DB,
  Employee,
  Product,
  Customer,
  Supplier,
  Transaction,
  TransactionItem,
  Expense,
  PurchaseOrder,
  Promotion,
  AppNotification,
  ActivityEntry,
  StockMovement,
  PaymentMethod,
  QrCode,
  QrOrder,
} from "./types";
import { dayKey, uid } from "./format";

// Deterministic RNG so the demo dataset looks the same every install.
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(1337);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const between = (min: number, max: number) => min + rnd() * (max - min);
const intBetween = (min: number, max: number) => Math.floor(between(min, max + 1));

function isoDaysAgo(days: number, hour = 12, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, intBetween(0, 59), 0);
  return d.toISOString();
}

export function defaultSettings() {
  return {
    businessName: "Nova Market & Cafe",
    address: "128 Maple Street, Springfield",
    phone: "(555) 210-8834",
    email: "hello@novamarket.com",
    currencyCode: "USD",
    currencySymbol: "$",
    taxEnabled: true,
    taxRate: 8.5,
    receiptFooter: "Thank you for shopping with us!",
    paymentMethods: { cash: true, card: true, mobile: true, other: true },
    theme: "light" as const,
    loyalty: {
      enabled: true,
      earnPerUnit: 0.1, // 1 point per $10 spent
      pointsPerUnit: 100, // 100 points = $1 off
      levels: [
        { name: "Bronze", threshold: 0, perkPercent: 0 },
        { name: "Silver", threshold: 300, perkPercent: 2 },
        { name: "Gold", threshold: 1200, perkPercent: 5 },
      ],
    },
    largeRefundThreshold: 150,
    onboardingComplete: false,
    demoData: false,
    nextTxnNumber: 1,
    nextPoNumber: 1,
    nextQrNumber: 1041,
    qr: {
      enabled: true,
      serviceMode: "table" as const,
      allowName: true,
      allowPhone: false,
      allowNotes: true,
      soundEnabled: true,
      instructions: "Scan, browse our menu and place your order. Pay at the counter when you collect.",
    },
  };
}

export function buildDemoDB(): DB {
  const employees: Employee[] = [
    { id: "emp_1", name: "Alex Rivera", username: "alex", role: "admin", pin: "1111", phone: "(555) 301-1122", email: "alex@novamarket.com", status: "active", joinedAt: isoDaysAgo(720) },
    { id: "emp_2", name: "Sam Chen", username: "sam", role: "manager", pin: "2222", phone: "(555) 301-4433", email: "sam@novamarket.com", status: "active", joinedAt: isoDaysAgo(430) },
    { id: "emp_3", name: "Jamie Fox", username: "jamie", role: "cashier", pin: "3333", phone: "(555) 301-7788", email: "", status: "active", joinedAt: isoDaysAgo(150) },
  ];

  const suppliers: Supplier[] = [
    { id: "sup_1", company: "Brewline Coffee Co.", contactPerson: "Dana White", phone: "(555) 411-2001", email: "orders@brewline.co", address: "9 Roast Ave, Portland", notes: "Weekly Tuesday deliveries.", createdAt: isoDaysAgo(600) },
    { id: "sup_2", company: "Fresh Farms Wholesale", contactPerson: "Miguel Torres", phone: "(555) 411-8422", email: "sales@freshfarms.com", address: "45 Orchard Rd, Greenfield", notes: "Best prices on dairy & produce.", createdAt: isoDaysAgo(520) },
    { id: "sup_3", company: "SnackWorks Distribution", contactPerson: "Priya Patel", phone: "(555) 411-9034", email: "hello@snackworks.io", address: "210 Trade Blvd, Dayton", createdAt: isoDaysAgo(400) },
    { id: "sup_4", company: "HomeEssentials Supply", contactPerson: "Kate Moore", phone: "(555) 411-7766", email: "support@homeessentials.com", address: "17 Depot Ln, Fairview", notes: "Minimum order $300.", createdAt: isoDaysAgo(350) },
  ];

  const productSeed: Array<[string, string, string, number, number, number, number]> = [
    ["Espresso Beans 1kg", "Beverages", "sup_1", 11.5, 18.99, 24, 6],
    ["Cold Brew Bottle 330ml", "Beverages", "sup_1", 2.1, 4.5, 48, 12],
    ["Orange Juice 1L", "Beverages", "sup_2", 1.8, 3.99, 36, 10],
    ["Sparkling Water 500ml", "Beverages", "sup_2", 0.55, 1.49, 96, 24],
    ["Green Tea Box (25 bags)", "Beverages", "sup_1", 3.2, 6.49, 18, 6],
    ["Cola Can 330ml", "Beverages", "sup_3", 0.45, 1.25, 0, 24],
    ["Sourdough Loaf", "Bakery", "sup_2", 1.6, 4.25, 14, 8],
    ["Butter Croissant", "Bakery", "sup_2", 0.75, 2.5, 30, 10],
    ["Blueberry Muffin", "Bakery", "sup_2", 0.85, 2.75, 22, 10],
    ["Chocolate Cake Slice", "Bakery", "sup_2", 1.4, 4.95, 9, 6],
    ["Bagels 6-pack", "Bakery", "sup_2", 2.3, 5.49, 16, 6],
    ["Trail Mix 200g", "Snacks", "sup_3", 1.9, 4.75, 26, 8],
    ["Potato Chips 150g", "Snacks", "sup_3", 0.8, 2.25, 54, 15],
    ["Dark Chocolate Bar", "Snacks", "sup_3", 1.05, 3.25, 41, 12],
    ["Granola Bars 6-pack", "Snacks", "sup_3", 2.4, 5.25, 19, 8],
    ["Popcorn Tub", "Snacks", "sup_3", 0.95, 2.95, 27, 8],
    ["Whole Milk 1L", "Groceries", "sup_2", 0.9, 2.19, 44, 15],
    ["Free-range Eggs 12pk", "Groceries", "sup_2", 2.6, 4.99, 33, 12],
    ["Cheddar Cheese 250g", "Groceries", "sup_2", 2.75, 5.99, 21, 8],
    ["Basmati Rice 2kg", "Groceries", "sup_4", 3.5, 7.49, 25, 8],
    ["Olive Oil 500ml", "Groceries", "sup_4", 4.2, 9.99, 17, 6],
    ["Pasta 500g", "Groceries", "sup_4", 0.85, 2.19, 62, 20],
    ["Tomato Sauce 400g", "Groceries", "sup_4", 0.95, 2.49, 47, 15],
    ["Honey Jar 350g", "Groceries", "sup_2", 3.1, 6.99, 12, 5],
    ["Shampoo 400ml", "Personal Care", "sup_4", 2.35, 5.99, 23, 8],
    ["Toothpaste 100ml", "Personal Care", "sup_4", 0.95, 2.89, 38, 12],
    ["Hand Soap 250ml", "Personal Care", "sup_4", 1.15, 3.29, 29, 10],
    ["Paper Towels 2-pack", "Household", "sup_4", 1.55, 3.99, 40, 15],
    ["Dish Soap 500ml", "Household", "sup_4", 1.25, 3.49, 31, 10],
    ["Laundry Detergent 1L", "Household", "sup_4", 3.4, 7.99, 5, 8],
  ];

  let skuNum = 1000;
  const products: Product[] = productSeed.map(([name, category, supplierId, cost, price, stock, low], idx) => ({
    id: `prd_${idx + 1}`,
    name,
    sku: `NM-${skuNum++}`,
    barcode: String(600000000000 + idx * 777),
    category,
    supplierId,
    cost,
    price,
    stock,
    lowStockThreshold: low,
    status: "active" as const,
    sold: 0,
    createdAt: isoDaysAgo(intBetween(120, 700), 9),
  }));

  const customers: Customer[] = [
    { id: "cus_1", name: "Maria Lopez", phone: "(555) 610-2255", email: "maria.l@example.com", address: "88 Elm St", notes: "Prefers paper receipts.", totalSpent: 0, purchases: 0, loyaltyPoints: 0, storeCredit: 0, createdAt: isoDaysAgo(365) },
    { id: "cus_2", name: "David Kim", phone: "(555) 610-8899", email: "d.kim@example.com", totalSpent: 0, purchases: 0, loyaltyPoints: 0, storeCredit: 0, createdAt: isoDaysAgo(280) },
    { id: "cus_3", name: "Sarah Johnson", phone: "(555) 610-4410", email: "sarahj@example.com", address: "12 Birch Ave", totalSpent: 0, purchases: 0, loyaltyPoints: 0, storeCredit: 5, createdAt: isoDaysAgo(220) },
    { id: "cus_4", name: "Robert Brown", phone: "(555) 610-3321", email: "", totalSpent: 0, purchases: 0, loyaltyPoints: 0, storeCredit: 0, createdAt: isoDaysAgo(190) },
    { id: "cus_5", name: "Emily Davis", phone: "(555) 610-9012", email: "emily.d@example.com", notes: "Allergic to nuts.", totalSpent: 0, purchases: 0, loyaltyPoints: 0, storeCredit: 0, createdAt: isoDaysAgo(120) },
    { id: "cus_6", name: "James Wilson", phone: "(555) 610-6677", email: "jwilson@example.com", totalSpent: 0, purchases: 0, loyaltyPoints: 0, storeCredit: 0, createdAt: isoDaysAgo(90) },
    { id: "cus_7", name: "Linda Martinez", phone: "(555) 610-2048", email: "", totalSpent: 0, purchases: 0, loyaltyPoints: 0, storeCredit: 0, createdAt: isoDaysAgo(60) },
    { id: "cus_8", name: "Omar Hassan", phone: "(555) 610-5150", email: "omar.h@example.com", totalSpent: 0, purchases: 0, loyaltyPoints: 0, storeCredit: 0, createdAt: isoDaysAgo(30) },
  ];

  const TAX_RATE = 8.5;
  const transactions: Transaction[] = [];
  let txnCounter = 1;

  for (let daysAgo = 56; daysAgo >= 0; daysAgo--) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const weekday = date.getDay();
    const baseCount = weekday === 0 || weekday === 6 ? intBetween(4, 7) : intBetween(2, 5);
    // Recent weeks trend slightly higher so charts look alive.
    const count = baseCount + (daysAgo < 14 ? intBetween(0, 2) : 0);

    for (let s = 0; s < count; s++) {
      const hour = pick([8, 9, 10, 11, 12, 12, 13, 14, 15, 16, 17, 18, 19]);
      const itemLines: TransactionItem[] = [];
      const lineCount = intBetween(1, 4);
      const usedProducts = new Set<number>();
      for (let li = 0; li < lineCount; li++) {
        let pi = intBetween(0, products.length - 1);
        while (usedProducts.has(pi)) pi = intBetween(0, products.length - 1);
        usedProducts.add(pi);
        const p = products[pi];
        if (p.stock === 0 && rnd() > 0.06) continue;
        const qty = p.price > 8 ? intBetween(1, 2) : intBetween(1, 3);
        itemLines.push({
          productId: p.id,
          name: p.name,
          sku: p.sku,
          price: p.price,
          cost: p.cost,
          qty,
          lineDiscount: 0,
        });
        p.sold += qty;
      }
      if (itemLines.length === 0) continue;

      const subtotal = itemLines.reduce((sum, it) => sum + it.price * it.qty, 0);
      const withCustomer = rnd() < 0.45;
      const customer = withCustomer ? pick(customers.filter((c) => new Date(c.createdAt) <= date)) : undefined;
      const employee = pick([employees[2], employees[2], employees[1], employees[0]]);
      const methodRoll = rnd();
      const paymentMethod: PaymentMethod =
        methodRoll < 0.44 ? "cash" : methodRoll < 0.78 ? "card" : methodRoll < 0.97 ? "mobile" : "other";
      const discount = subtotal >= 60 ? Math.round(subtotal * 0.1 * 100) / 100 : 0;
      const taxable = Math.max(0, subtotal - discount);
      const tax = Math.round(taxable * (TAX_RATE / 100) * 100) / 100;
      const total = Math.round((taxable + tax) * 100) / 100;
      const amountPaid =
        paymentMethod === "cash" ? Math.ceil(total / (total > 50 ? 10 : 5)) * (total > 50 ? 10 : 5) : total;
      const pointsEarned =
        customer && rnd() < 0.9
          ? Math.floor(taxable * defaultSettings().loyalty.earnPerUnit)
          : 0;

      transactions.push({
        id: uid("txn"),
        number: `TXN-${String(txnCounter).padStart(5, "0")}`,
        date: isoDaysAgo(daysAgo, hour, intBetween(0, 59)),
        employeeId: employee.id,
        employeeName: employee.name,
        customerId: customer?.id ?? null,
        customerName: customer?.name,
        items: itemLines,
        subtotal: Math.round(subtotal * 100) / 100,
        discount,
        promoNames: discount > 0 ? ["Happy Hour 10%"] : [],
        pointsRedeemed: 0,
        pointsEarned,
        tax,
        total,
        paymentMethod,
        amountPaid,
        change: Math.round((amountPaid - total) * 100) / 100,
        status: "completed",
      });
      txnCounter++;
    }
  }

  // A couple of refunds in history for realistic reports.
  const refundCandidates = transactions.filter(
    (t) => t.total > 20 && daysBetweenKeys(t.date) <= 30
  );
  for (let i = 0; i < 3 && i < refundCandidates.length; i++) {
    const t = refundCandidates[intBetween(0, refundCandidates.length - 1)];
    t.status = "refunded";
    t.refundedAt = isoDaysAgo(intBetween(0, 5), 11);
    t.employeeName = "Sam Chen";
  }

  // Customer aggregates + loyalty from their purchases.
  for (const t of transactions) {
    if (!t.customerId || t.status !== "completed") continue;
    const c = customers.find((x) => x.id === t.customerId);
    if (!c) continue;
    c.purchases += 1;
    c.totalSpent += t.total;
    c.loyaltyPoints += t.pointsEarned;
  }
  customers.forEach((c) => {
    c.totalSpent = Math.round(c.totalSpent * 100) / 100;
  });

  const expenses: Expense[] = [];
  const pushExpense = (
    name: string,
    category: string,
    amount: number,
    daysAgo: number,
    method: PaymentMethod
  ) => {
    expenses.push({
      id: uid("exp"),
      name,
      category,
      amount,
      date: isoDaysAgo(daysAgo).slice(0, 10),
      paymentMethod: method,
      createdAt: isoDaysAgo(daysAgo),
    });
  };
  for (const months of [2, 1]) {
    const d = months * 30 + intBetween(-3, 3);
    pushExpense("Store rent", "Rent", 2400, d, "card");
    pushExpense("Electricity & water", "Utilities", Math.round(between(140, 230)), d + 4, "card");
    pushExpense("Staff salaries", "Salaries", 4200, d + 1, "other");
    pushExpense("Cleaning supplies", "Supplies", Math.round(between(45, 110)), d + 8, "cash");
    pushExpense("Window signage print", "Marketing", 180, d + 12, "card");
  }
  pushExpense("Staff salaries", "Salaries", 4200, 8, "other");
  pushExpense("Espresso machine repair", "Repairs", 260, 6, "card");
  pushExpense("Social media ads", "Marketing", 95, 3, "mobile");
  pushExpense("Paper bags & cups restock", "Supplies", 78, 2, "card");
  pushExpense("Water bill", "Utilities", 132, 1, "card");

  const purchaseOrders: PurchaseOrder[] = [
    {
      id: uid("po"),
      poNumber: "PO-00001",
      supplierId: "sup_1",
      items: [
        { productId: "prd_1", name: products[0].name, sku: products[0].sku, qty: 20, cost: 11.5, receivedQty: 20 },
        { productId: "prd_5", name: products[4].name, sku: products[4].sku, qty: 15, cost: 3.2, receivedQty: 15 },
      ],
      status: "received",
      paid: true,
      paidAt: isoDaysAgo(18),
      createdAt: isoDaysAgo(21),
      orderedAt: isoDaysAgo(21),
      receivedAt: isoDaysAgo(18),
      createdBy: "Alex Rivera",
    },
    {
      id: uid("po"),
      poNumber: "PO-00002",
      supplierId: "sup_2",
      items: [
        { productId: "prd_7", name: products[6].name, sku: products[6].sku, qty: 30, cost: 1.6, receivedQty: 0 },
        { productId: "prd_17", name: products[16].name, sku: products[16].sku, qty: 40, cost: 0.9, receivedQty: 0 },
        { productId: "prd_18", name: products[17].name, sku: products[17].sku, qty: 25, cost: 2.6, receivedQty: 0 },
      ],
      status: "ordered",
      createdAt: isoDaysAgo(3),
      orderedAt: isoDaysAgo(2),
      createdBy: "Sam Chen",
    },
    {
      id: uid("po"),
      poNumber: "PO-00003",
      supplierId: "sup_4",
      items: [
        { productId: "prd_30", name: products[29].name, sku: products[29].sku, qty: 24, cost: 3.4, receivedQty: 0 },
        { productId: "prd_28", name: products[27].name, sku: products[27].sku, qty: 30, cost: 1.55, receivedQty: 0 },
      ],
      status: "draft",
      createdAt: isoDaysAgo(1),
      createdBy: "Sam Chen",
    },
  ];

  const promotions: Promotion[] = [
    {
      id: uid("promo"),
      name: "Happy Hour 10% Off",
      type: "percent",
      value: 10,
      buyQty: 0,
      getQty: 0,
      scope: "order",
      minOrder: 60,
      autoApply: true,
      active: true,
      description: "Applies automatically to orders over $60.",
    },
    {
      id: uid("promo"),
      name: "WELCOME5 Coupon",
      type: "fixed",
      value: 5,
      buyQty: 0,
      getQty: 0,
      scope: "order",
      code: "WELCOME5",
      minOrder: 20,
      autoApply: false,
      active: true,
      description: "$5 off orders over $20.",
    },
    {
      id: uid("promo"),
      name: "Chips BOGO",
      type: "bogo",
      value: 0,
      buyQty: 1,
      getQty: 1,
      scope: "product",
      targetId: "prd_13",
      minOrder: 0,
      autoApply: true,
      startDate: isoDaysAgo(10).slice(0, 10),
      endDate: "",
      active: true,
      description: "Buy one Potato Chips, get one free.",
    },
    {
      id: uid("promo"),
      name: "Summer Beverages 15%",
      type: "percent",
      value: 15,
      buyQty: 0,
      getQty: 0,
      scope: "category",
      targetId: "Beverages",
      minOrder: 0,
      autoApply: false,
      active: false,
      description: "Seasonal promotion — currently paused.",
    },
  ];

  const stockHistory: StockMovement[] = products.map((p) => ({
    id: uid("mov"),
    date: p.createdAt,
    productId: p.id,
    productName: p.name,
    change: p.stock,
    reason: "initial",
    reference: "Opening stock",
    resultingStock: p.stock,
  }));
  stockHistory.push({
    id: uid("mov"),
    date: isoDaysAgo(18),
    productId: "prd_1",
    productName: products[0].name,
    change: 20,
    reason: "purchase",
    reference: "PO-00001",
    byEmployee: "Sam Chen",
    resultingStock: products[0].stock,
  });
  stockHistory.push({
    id: uid("mov"),
    date: isoDaysAgo(5),
    productId: "prd_24",
    productName: products[23].name,
    change: -2,
    reason: "adjustment",
    reference: "Damaged jar in storage",
    byEmployee: "Sam Chen",
    resultingStock: products[23].stock,
  });

  const outOfStock = products.filter((p) => p.stock === 0);
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= p.lowStockThreshold);
  const notifications: AppNotification[] = [
    ...outOfStock.map((p) => ({
      id: uid("ntf"),
      type: "out-of-stock" as const,
      title: "Out of stock",
      message: `${p.name} has run out. Reorder soon.`,
      date: isoDaysAgo(1),
      read: false,
      link: "/inventory",
    })),
    ...lowStock.slice(0, 3).map((p) => ({
      id: uid("ntf"),
      type: "low-stock" as const,
      title: "Low stock warning",
      message: `${p.name} is down to ${p.stock} units.`,
      date: isoDaysAgo(1),
      read: false,
      link: "/inventory",
    })),
    {
      id: uid("ntf"),
      type: "po-pending",
      title: "Purchase order awaiting delivery",
      message: "PO-00002 from Fresh Farms Wholesale was marked as ordered 2 days ago.",
      date: isoDaysAgo(2),
      read: false,
      link: "/purchase-orders",
    },
    {
      id: uid("ntf"),
      type: "system",
      title: "Welcome to NovaPOS",
      message: "You're exploring demo data — everything here can be edited or replaced.",
      date: isoDaysAgo(2),
      read: true,
      link: "/settings",
    },
  ];

  const activityLog: ActivityEntry[] = [
    { id: uid("act"), date: isoDaysAgo(0, 8, 5), employeeId: "emp_3", employeeName: "Jamie Fox", type: "login", action: "Signed in", detail: "Cashier shift started" },
    { id: uid("act"), date: isoDaysAgo(0, 9, 40), employeeId: "emp_2", employeeName: "Sam Chen", type: "inventory", action: "Adjusted stock", detail: "Honey Jar 350g · −2 (Damaged jar)" },
    { id: uid("act"), date: isoDaysAgo(1, 16, 20), employeeId: "emp_2", employeeName: "Sam Chen", type: "refund", action: "Refunded transaction", detail: `${transactions[transactions.length - 2]?.number ?? "TXN"} · ${fmtShort(transactions[transactions.length - 2]?.total ?? 0)}` },
    { id: uid("act"), date: isoDaysAgo(2, 10, 15), employeeId: "emp_1", employeeName: "Alex Rivera", type: "purchase", action: "Marked PO as ordered", detail: "PO-00002 · Fresh Farms Wholesale" },
  ];

  const settings = defaultSettings();
  settings.onboardingComplete = true;
  settings.demoData = true;
  settings.nextTxnNumber = txnCounter;
  settings.nextPoNumber = 4;
  settings.nextQrNumber = 1043;

  // ── QR self-ordering demo data ────────────────────────────────────────────
  // FIXED ids: printed wall posters keep working across demo resets, restarts
  // and reinstalls. Never make these random.
  const qrCodes: QrCode[] = [
    { id: "qr_table_1", label: "Table 1", active: true, createdAt: isoDaysAgo(30), scans: 14 },
    { id: "qr_table_2", label: "Table 2", active: true, createdAt: isoDaysAgo(30), scans: 9 },
    { id: "qr_counter", label: "Counter", active: true, createdAt: isoDaysAgo(21), scans: 22 },
    { id: "qr_waiting_area", label: "Waiting Area", active: false, createdAt: isoDaysAgo(12), scans: 2 },
  ];

  const mkQrItem = (idx: number, qty: number): TransactionItem => ({
    productId: products[idx].id,
    name: products[idx].name,
    sku: products[idx].sku,
    price: products[idx].price,
    cost: products[idx].cost,
    qty,
    lineDiscount: 0,
  });

  const qrOrders: QrOrder[] = [
    {
      id: uid("qro"),
      number: "ORD-1041",
      qrCodeId: qrCodes[0].id,
      locationLabel: "Table 1",
      sessionId: "demo-session-a",
      customerName: "Morgan",
      note: "No onions please",
      items: [mkQrItem(0, 2), mkQrItem(6, 1)],
      subtotal: products[0].price * 2 + products[6].price,
      discount: 0,
      promoNames: [],
      tax: Math.round(((products[0].price * 2 + products[6].price) * settings.taxRate) / 100 * 100) / 100,
      total: 0,
      status: "new",
      createdAt: isoDaysAgo(0, 10, 42),
      handledBy: undefined,
    },
    {
      id: uid("qro"),
      number: "ORD-1042",
      qrCodeId: qrCodes[2].id,
      locationLabel: "Counter",
      sessionId: "demo-session-b",
      items: [mkQrItem(12, 1)],
      subtotal: products[12].price,
      discount: 0,
      promoNames: [],
      tax: Math.round((products[12].price * settings.taxRate) / 100 * 100) / 100,
      total: 0,
      status: "ready",
      createdAt: isoDaysAgo(0, 9, 55),
      acceptedAt: isoDaysAgo(0, 9, 57),
      readyAt: isoDaysAgo(0, 10, 8),
      handledBy: "Sam Chen",
    },
  ];
  for (const o of qrOrders) {
    o.total = Math.round((o.subtotal + o.tax) * 100) / 100;
  }
  notifications.unshift({
    id: uid("ntf"),
    type: "qr-order",
    title: "New QR order",
    message: `ORD-1041 · Table 1 · ${qrOrders[0].items.reduce((s, i) => s + i.qty, 0)} items`,
    date: isoDaysAgo(0, 10, 42),
    read: false,
    link: "/orders",
  });
  activityLog.push({
    id: uid("act"),
    date: isoDaysAgo(0, 10, 42),
    employeeId: null,
    employeeName: "QR Customer",
    type: "system",
    action: "QR order placed",
    detail: "ORD-1041 · Table 1",
  });

  return {
    version: 1,
    products,
    customers,
    employees,
    suppliers,
    purchaseOrders,
    transactions: transactions.reverse(),
    promotions,
    expenses,
    notifications,
    activityLog,
    stockHistory,
    heldSales: [],
    qrCodes,
    qrOrders,
    settings,
  };
}

function daysBetweenKeys(iso: string): number {
  return Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
}

/** A blank, fully-populated database — also the base for migrating old stored data. */
export function buildEmptyDB(): DB {
  return {
    version: 1,
    products: [],
    customers: [],
    employees: [],
    suppliers: [],
    purchaseOrders: [],
    transactions: [],
    promotions: [],
    expenses: [],
    notifications: [],
    activityLog: [],
    stockHistory: [],
    heldSales: [],
    qrCodes: [],
    qrOrders: [],
    settings: defaultSettings(),
  };
}

function fmtShort(n: number): string {
  return `$${n.toFixed(2)}`;
}

// Re-export for consumers that need the current day key helper.
export { dayKey };
