import type { Permissions } from "../lib/permissions";

// ---------------------------------------------------------------
// Help content model
// The Help Center is content-driven: each article is a list of typed
// blocks that a single renderer (src/pages/Help.tsx) turns into UI.
// Add or edit articles here without touching any rendering code.
// ---------------------------------------------------------------

export type HelpBlock =
  | { type: "p"; text: string }
  | { type: "h3"; text: string }
  | { type: "steps"; title?: string; steps: string[] }
  | { type: "list"; title?: string; items: string[]; ordered?: boolean }
  | { type: "table"; head: string[]; rows: string[][] }
  | { type: "note"; tone: "tip" | "info" | "warn" | "danger"; title?: string; text: string }
  | { type: "keys"; rows: [string, string][] }
  | { type: "probe"; problem: string; cause: string; fix: string[]; admin: string }
  | { type: "links"; label: string; items: Array<{ label: string; to: string }> };

export interface HelpArticle {
  slug: string;
  title: string;
  description: string;
  keywords?: string[];
  /** Hide the article from the current user when this returns false. */
  minAccess?: (p: Permissions) => boolean;
  blocks: HelpBlock[];
}

export interface HelpCategory {
  id: string;
  label: string;
  blurb: string;
  articles: HelpArticle[];
}

// Helpers so every page reads consistently.
const can = {
  pos: (p: Permissions) => p.pos,
  refund: (p: Permissions) => p.refund,
  products: (p: Permissions) => p.manageProducts,
  inventory: (p: Permissions) => p.manageInventory,
  suppliers: (p: Permissions) => p.manageSuppliers,
  purchases: (p: Permissions) => p.managePurchases,
  promotions: (p: Permissions) => p.managePromotions,
  expenses: (p: Permissions) => p.manageExpenses,
  qr: (p: Permissions) => p.manageQr,
  reports: (p: Permissions) => p.viewReports,
  employees: (p: Permissions) => p.manageEmployees,
  settings: (p: Permissions) => p.manageSettings,
};

export const HELP_CATEGORIES: HelpCategory[] = [
  // ── Getting Started ──────────────────────────────────────────────────────
  {
    id: "getting-started",
    label: "Getting Started",
    blurb: "Set up the business, create your first products and make your first sale.",
    articles: [
      {
        slug: "first-day-setup-checklist",
        title: "First Day Setup Checklist",
        description: "Everything to configure before you open the register.",
        keywords: ["setup", "checklist", "beginner", "new business", "onboarding", "first day"],
        blocks: [
          { type: "p", text: "Follow this checklist in order and your register will be ready to take its first sale in about ten minutes." },
          { type: "steps", title: "Checklist", steps: [
            "Complete the Setup Wizard — on your very first sign-in NovaPOS walks you through Business name, Currency, Tax, Payments and your Owner account.",
            "Open Settings and confirm your business profile (name, address, phone, email and logo).",
            "Add your suppliers under Suppliers so the system knows who you buy from.",
            "Add your first products under Products — name, selling price and cost price are the essentials.",
            "Set an opening stock level on each product (or add stock later with Inventory adjustments).",
            "Open New Sale, search for a product, tap it, then complete the sale with your chosen payment method.",
            "Check Inventory to confirm stock went down, then check Reports to confirm the sale is recorded.",
            "Add the rest of your staff under Employees with usernames and PINs.",
            "Create QR codes under QR Ordering, print the posters and place them on tables or the counter.",
          ]},
          { type: "note", tone: "tip", title: "Explore demo data first", text: "In the Login screen you can explore with demo data to try everything safely. Anything you change in demo mode is fine to experiment with — you can restore fresh demo data anytime from Settings → Data." },
        ],
      },
      {
        slug: "signing-in-and-signing-out",
        title: "Signing In and Signing Out",
        description: "Use your username and PIN to open the register, and switch users safely.",
        keywords: ["login", "pin", "sign in", "sign out", "logout", "username"],
        blocks: [
          { type: "steps", title: "To sign in", steps: [
            "Choose your name from the employee list (or type your username into the username field).",
            "Enter your 4–6 digit PIN on the keypad.",
            "Press Sign in.",
          ]},
          { type: "p", text: "Your PIN is stored securely (hashed) and never shown. After several wrong attempts the account is temporarily locked to protect the business — an owner can help if that happens." },
          { type: "steps", title: "To sign out", steps: [
            "Tap your name in the top-right corner of the screen.",
            "Choose Sign out.",
          ]},
          { type: "note", tone: "info", title: "Sessions", text: "A successful sign-in opens a session that stays active while you use the app. Signing out always returns you to the login screen. If a session is idle or the page reloads, sign in again." },
          { type: "note", tone: "warn", title: "Forgot your PIN?", text: "PINs can only be reset by an owner from Employees. There is no recovery code — keep it private and don't share it." },
        ],
      },
      {
        slug: "understanding-the-navigation",
        title: "Understanding the Navigation",
        description: "The sidebar groups everything you need into Sell, Inventory, Business and System.",
        keywords: ["menu", "sidebar", "navigation", "pages", "routes", "where is"],
        blocks: [
          { type: "p", text: "On desktop the menu is a sidebar on the left. On phones it opens with the menu button and is also available through the More tab in the bottom bar." },
          { type: "table", head: ["Section", "What lives there"], rows: [
            ["Dashboard", "Today's performance: sales, profit, low stock, recent orders and charts."],
            ["Sell", "New Sale, Customer Orders, Transactions and Customers."],
            ["Inventory", "Products, Inventory, Suppliers and Purchase Orders."],
            ["Business", "Promotions, Expenses and Reports."],
            ["System", "Staff Chat, Notifications, QR Ordering, Employees, Help & Guide and Settings."],
          ]},
          { type: "p", text: "Which pages you see depends on your role. Owners and managers see the full menu; cashiers see selling tools, customers, chat and notifications but not settings, reports or inventory management." },
          { type: "note", tone: "tip", text: "Keyboard shortcut ? (question mark) opens the quick Help dialog anywhere in the app. The Help & Guide page you are reading now has everything in detail." },
        ],
      },
      {
        slug: "onboarding-your-business",
        title: "Setting Up Your Business (Setup Wizard)",
        description: "The guided onboarding that configures your business and creates your owner account.",
        keywords: ["onboarding", "wizard", "setup", "owner account", "currency", "tax", "payments"],
        blocks: [
          { type: "p", text: "The first time the app opens you are taken through a six-step setup. You can always change these things later in Settings." },
          { type: "steps", title: "The six steps", steps: [
            "Business info — business name, address, phone, email and an optional logo (under 400 KB).",
            "Currency — pick your local currency; it formats every price and total.",
            "Tax — turn tax on and set your rate (e.g. 8.5%). It is applied to every sale.",
            "Payments — enable the payment methods you accept: cash, card, mobile and other.",
            "Owner account — create the first employee: an Owner with full access, named, with a username and a 4+ digit PIN.",
            "Ready — review your choices and press Open my register, or choose to explore demo data first.",
          ]},
          { type: "note", tone: "info", title: "Demo data vs. a fresh start", text: "Choosing demo data loads a sample cafe so you can click around freely. Choosing to set up your business creates the owner account and takes you straight to Products to add your real stock." },
        ],
      },
    ],
  },

  // ── Dashboard ────────────────────────────────────────────────────────────
  {
    id: "dashboard",
    label: "Dashboard",
    blurb: "Understand the home screen — metrics, charts and daily performance.",
    articles: [
      {
        slug: "dashboard-overview",
        title: "Dashboard Overview",
        description: "What is on the home screen and how to change the time period.",
        keywords: ["home", "metrics", "charts", "date range", "preset", "today", "yesterday"],
        blocks: [
          { type: "p", text: "The Dashboard is the first screen after sign-in. It shows how the business is doing for the selected period, with shortcuts to act on low stock and recent orders." },
          { type: "steps", title: "Choose a time period", steps: [
            "Use the Today / Yesterday / Last 7 days / Last 30 days buttons at the top.",
            "Or open the custom date picker to choose any start and end date.",
          ]},
          { type: "p", text: "Each metric shows a growth badge comparing this period with the previous identical period (when it can be calculated)." },
          { type: "note", tone: "info", text: "Cashiers see the Dashboard, but detailed Reports (profit, products, employees) require the View reports permission and are hidden for cashier accounts." },
        ],
      },
      {
        slug: "understanding-your-metrics",
        title: "Understanding Your Dashboard Metrics",
        description: "What every number and chart on the Dashboard means.",
        keywords: ["revenue", "profit", "sales", "cost", "low stock", "orders", "payments", "best sellers", "metric"],
        blocks: [
          { type: "table", head: ["Metric", "Meaning", "Why it matters"], rows: [
            ["Sales / Revenue", "The total amount (before refunds) of completed sales in the period.", "Your top line — what customers paid."],
            ["Profit", "Revenue minus the cost of the goods sold and discounts (called gross profit). Also shown net of expenses and refunds.", "Tells you what a period actually earned."],
            ["Sales count", "Number of completed transactions in the period.", "Shows how busy you were."],
            ["Average order value", "Revenue divided by the number of sales.", "Reveals if customers are spending more or less per visit."],
            ["Items sold", "Total quantity of units bought in the period.", "Volume across the menu."],
            ["Refunds", "Total value of refunded transactions.", "Flags problem stock or service."],
            ["Expenses", "Rent, salaries, utilities and other logged expenses.", "Operating costs that eat into profit."],
            ["Inventory value", "What you are currently holding, valued at cost price.", "How much cash is tied up in stock."],
            ["Low / Out of stock", "Active products at or below their alert threshold, or with zero stock.", "What needs reordering before you run out."],
            ["Pending orders", "QR customer orders waiting for staff to accept.", "Service actions that need your attention."],
          ]},
          { type: "p", text: "The area chart plots revenue across every day in the range. The pie chart breaks revenue down by payment method (cash, card, mobile, other). The side panel lists low stock, best sellers and recent activity." },
          { type: "note", tone: "tip", text: "Numbers react instantly: complete a sale, receive a purchase order, or log an expense and the Dashboard updates." },
        ],
      },
    ],
  },

  // ── Point of Sale ───────────────────────────────────────────────────────
  {
    id: "pos",
    label: "Point of Sale",
    blurb: "Take sales at the counter, apply discounts and finish with any payment method.",
    articles: [
      {
        slug: "make-a-sale",
        title: "How to Make a Sale",
        description: "The complete step-by-step: find products, build the cart, take payment.",
        keywords: ["sale", "charge", "cart", "checkout", "payment", "complete", "walk-in"],
        blocks: [
          { type: "p", text: "New Sale (POS) is where you build a cart and take payment. Products are tapped onto the cart, then one button completes the sale." },
          { type: "steps", title: "Make a sale", steps: [
            "Open New Sale from the sidebar (or the New Sale button at the top of every screen).",
            "Find the product — use the search box (matches name, SKU or barcode) or tap a category chip and then a product card.",
            "Tap the product to add it to the cart. Tap again, or use +/- on the cart line, to change the quantity.",
            "Optional: attach a customer, apply a discount, add a note, or redeem loyalty points via the Discount button in the cart.",
            "Set the payment method — the button at the bottom of the cart shows the running total, e.g. Complete sale — $12.40.",
            "Choose Cash, Card, Mobile or Other. For cash, enter the amount received; the change is calculated for you.",
            "Press Complete sale.",
          ]},
          { type: "p", text: "Afterwards a success screen shows the receipt number (e.g. TXN-00042) and lets you preview, print or save the receipt, then start the next sale." },
          { type: "note", tone: "warn", title: "Enter speeds things up", text: "In search, pressing Enter adds the best matching product straight to the cart — a barcode match first, then SKU, then the first search result." },
          { type: "note", tone: "info", title: "What happens next", text: "Stock is reduced per item, the item sold count increases, low-stock alerts may trigger, the customer's history grows (if attached), and the transaction appears in Transactions and all reports." },
        ],
      },
      {
        slug: "adding-product-to-cart",
        title: "Finding and Adding Products",
        description: "Search, categories and the rules that keep you from overselling.",
        keywords: ["search", "category", "barcode", "sku", "cart", "add", "quantity"],
        blocks: [
          { type: "list", title: "Ways to find a product", items: [
            "Search box — matches name, SKU or barcode as you type.",
            "Category chips — filter the grid with one tap.",
            "Barcode scanner / Enter — scan or type a barcode and press Enter; the matching product is added instantly.",
          ]},
          { type: "p", text: "Only active products appear. The grid shows the 60 most common products; anything beyond that is found with search." },
          { type: "list", title: "About quantities", items: [
            "Tap a card to add one unit (respecting stock).",
            "Use + and − on the cart line, or type the number directly.",
            "Typing 0 removes the line from the cart.",
            "You can't add more than the current stock — the app blocks it and explains how many are left.",
            "A ×N badge on the product card shows how many are already in the cart.",
          ]},
          { type: "note", tone: "warn", title: "Out of stock", text: "Products with zero stock still show so you can see what you're missing, but they can't be added to the cart." },
        ],
      },
      {
        slug: "discounts-coupons-and-loyalty",
        title: "Discounts, Coupons and Loyalty",
        description: "Handle promotions, manual discounts, coupon codes and loyalty points.",
        keywords: ["discount", "coupon", "promotion", "loyalty", "points", "percent off", "redeem", "manual"],
        blocks: [
          { type: "p", text: "Open Discount from the cart to see automatic promotions, a coupon field and a manual discount. The dialog is titled Discounts & loyalty when loyalty is enabled." },
          { type: "list", title: "How each discount works", items: [
            "Automatic promotions — deals you created in Promotions apply themselves when a qualifying item is in the cart (e.g. buy one get one).",
            "Coupon code — a customer presents a code; it must exist, be active and meet the minimum order to apply.",
            "Manual % discount — a one-off percentage off. Your role sets a limit: cashiers up to 10%, managers up to 30%, owners up to 100%.",
            "Loyalty tier perk — regular customers earn points and tier perks that can lower their total.",
          ]},
          { type: "note", tone: "info", title: "Only one wins", text: "If both a coupon and a manual discount are set, the better one for the customer is used. Promotions and loyalty perks apply on top." },
          { type: "steps", title: "Redeem loyalty points", steps: [
            "Attach a customer to the cart.",
            "Open Discount → the customer's points balance and approximate value appear.",
            "Enter how many points to redeem.",
            "Complete the sale — the value is taken off the total and the customer earns points on the rest.",
          ]},
          { type: "note", tone: "warn", text: "Discount limits are enforced at checkout by the pricing engine — a cashier can't sneak a 50% discount through a coupon." },
        ],
      },
      {
        slug: "held-sales",
        title: "Holding and Resuming a Sale",
        description: "Park a cart to serve the next customer, then come back to it.",
        keywords: ["hold", "held sale", "park", "resume", "f4"],
        blocks: [
          { type: "steps", title: "Hold a sale", steps: [
            "Build the cart for the customer who was interrupted.",
            "Press Hold (or F4).",
            "Give the cart a note if useful — it appears on the held list.",
            "Continue with the next customer normally.",
          ]},
          { type: "steps", title: "Resume a held sale", steps: [
            "Open Held sales from the cart panel.",
            "Find the sale (customer name or Walk-in, item count and time held).",
            "Press Resume — the items, customer and note come back into the cart.",
          ]},
          { type: "note", tone: "warn", title: "Empty the cart first", text: "Resume is disabled while your current cart has items. Clear or hold the current sale before resuming another." },
          { type: "note", tone: "danger", title: "Held sales aren't payments", text: "A held sale has not been paid. It stays in the held list until resumed or deleted." },
        ],
      },
      {
        slug: "taking-payment",
        title: "Taking Payment",
        description: "Cash, card, mobile and other — including change calculation.",
        keywords: ["payment", "cash", "card", "mobile", "change", "cash received", "terminal"],
        blocks: [
          { type: "list", title: "Payment methods", items: [
            "Cash — enter the amount received; NovaPOS rounds-up shortcuts (+5, +10, +20) and an Exact button fill it in for you, and change due is shown.",
            "Card — confirm the total is charged on the terminal, then complete.",
            "Mobile — same flow for QR / mobile wallets.",
            "Other — for any non-standard method.",
          ]},
          { type: "p", text: "Payment methods you disabled in Settings don't appear. If none are enabled, the app tells you to turn one on in Settings before completing sales." },
          { type: "note", tone: "warn", title: "Cash short pays are rejected", text: "If the amount received is less than the total, NovaPOS refuses the sale and tells you exactly how much is still owed." },
        ],
      },
      {
        slug: "receipts-and-order-numbers",
        title: "Receipts and Order Numbers",
        description: "What TXN numbers mean and how to preview, print and save receipts.",
        keywords: ["receipt", "print", "preview", "save", "txn", "number", "refunded"],
        blocks: [
          { type: "p", text: "Every completed sale gets a receipt number like TXN-00042. Numbers increase by one and are never reused." },
          { type: "list", title: "Receipt options after a sale", items: [
            "Preview — see the receipt on screen, including tax, discounts, payment and your business footer.",
            "Print — opens the standard print dialog.",
            "Save — downloads the receipt as an HTML file you can email or store.",
          ]},
          { type: "p", text: "Refunded receipts render with a REFUNDED mark when you view them from Transactions, so history stays honest." },
          { type: "note", tone: "tip", text: "The receipt footer you set in Settings → Receipts (e.g. “Thank you for shopping with us!”) appears on every printed receipt." },
        ],
      },
      {
        slug: "pos-keyboard-shortcuts",
        title: "POS Keyboard Shortcuts",
        description: "Speed up the counter with the keyboard.",
        keywords: ["shortcut", "keyboard", "f2", "f4", "f9", "esc", "enter"],
        blocks: [
          { type: "keys", rows: [
            ["F2", "Focus the product search box."],
            ["F4", "Hold the current sale."],
            ["F9", "Open the payment screen (when the cart has items)."],
            ["Enter", "Add the best matching product from search."],
            ["Esc", "Clear the search box / close dialogs."],
            ["?", "Open the quick Help dialog anywhere in the app."],
          ]},
          { type: "note", tone: "info", text: "Shortcuts don't trigger while you are typing in an input field, so a customer named “F9” won't accidentally pay." },
        ],
      },
    ],
  },

  // ── Products & Inventory ─────────────────────────────────────────────────
  {
    id: "products-inventory",
    label: "Products & Inventory",
    blurb: "Your catalogue, prices, stock levels, adjustments and movement history.",
    articles: [
      {
        slug: "add-a-product",
        title: "How to Add a Product",
        description: "Create a product with price, stock and a supplier.",
        keywords: ["add", "create", "product", "price", "cost", "stock", "opening stock"],
        blocks: [
          { type: "steps", title: "Add a product", steps: [
            "Open Products.",
            "Press Add Product.",
            "Enter the name (required).",
            "Set the cost price (what you pay) and selling price (what the customer pays — must be more than zero). The profit per item and margin are shown live.",
            "Enter an opening stock quantity if this product already exists on your shelves.",
            "Optional but recommended: a category, SKU (auto-generated if blank), barcode, linked supplier and low-stock alert threshold.",
            "Save.",
          ]},
          { type: "p", text: "Opening stock is recorded as an “initial” stock movement so you can trace it later in Inventory history." },
          { type: "note", tone: "tip", title: "Fast restock path", text: "Add the supplier first, then link products to it — this makes creating purchase orders much faster later." },
        ],
      },
      {
        slug: "edit-a-product",
        title: "How to Edit a Product",
        description: "Change prices, categories, suppliers and more — safely.",
        keywords: ["edit", "update", "change price", "margin", "duplicate"],
        blocks: [
          { type: "steps", title: "Edit a product", steps: [
            "Open Products and find the product (search name, SKU or barcode).",
            "Press the pencil icon on its row.",
            "Change any field. The profit/margin pill updates as you type.",
            "To change stock, use Inventory instead — stock on the product form only sets opening stock when creating.",
            "Save.",
          ]},
          { type: "list", title: "Common edits", items: [
            "Price and cost — be careful: past sales are not recalculated, they keep their recorded prices.",
            "Category — instantly reorganizes POS chips and inventory filters.",
            "Supplier — relinks the product to a supplier for purchase orders.",
            "Duplicate — copy any product as “<name> Copy” to build a similar item quickly.",
          ]},
          { type: "note", tone: "warn", title: "SKUs are unique", text: "Two products can't share the same SKU. If you see that error, use a different SKU value." },
        ],
      },
      {
        slug: "adjust-stock",
        title: "How to Adjust Stock",
        description: "Add, remove or set stock levels and explain the reason.",
        keywords: ["inventory", "adjust", "stock", "add stock", "remove stock", "count", "reason"],
        blocks: [
          { type: "p", text: "Use Inventory adjustments for anything that isn't a sale or a purchase order — spilled drinks, damaged goods, stock counts, returned-to-supplier cases, or gifts." },
          { type: "steps", title: "Adjust stock", steps: [
            "Open Inventory.",
            "Press the adjustment button on a product row (or use the Adjust action).",
            "Choose Add, Remove or Set.",
            "Enter the quantity.",
            "Pick a reason from the list (Restock delivery, Damaged / spoiled, Stock count correction, Returned to supplier, Gift / promotional use, or Other) and add a note if needed.",
            "Save.",
          ]},
          { type: "p", text: "Every adjustment is written to the stock history with the before and after levels, so you can always review what changed and who did it." },
          { type: "note", tone: "warn", text: "Remove clamps at zero — you can't push stock below 0. To correct a wrong number, use Set to the exact level." },
        ],
      },
      {
        slug: "find-a-product",
        title: "How to Find a Product",
        description: "Search and filter the catalogue quickly.",
        keywords: ["search", "filter", "find", "category", "sku", "barcode"],
        blocks: [
          { type: "p", text: "In Products, search matches name, SKU and barcode. You can filter by category and by status (All / Active / Archived)." },
          { type: "p", text: "In the POS, the same search powers the sale screen so a barcode or name finds the product instantly." },
          { type: "note", tone: "info", text: "Archived products are hidden from the POS and the inventory stock screen but their sales history is kept intact for reports." },
        ],
      },
      {
        slug: "archive-vs-delete",
        title: "Archive vs. Delete",
        description: "Why some products get archived instead of removed.",
        keywords: ["archive", "delete", "deactivate", "history", "sold"],
        blocks: [
          { type: "list", title: "The rule", items: [
            "A product that has never been sold can be permanently deleted.",
            "A product with sales history is archived instead — it disappears from the POS but its receipts and reports stay accurate. You can re-activate it anytime.",
          ]},
          { type: "note", tone: "info", text: "Bulk actions let you archive or activate many products at once, and change prices across a selection with a single +/- percentage." },
        ],
      },
      {
        slug: "inventory-history",
        title: "Inventory History",
        description: "Every change to stock, reviewed in one list.",
        keywords: ["history", "movements", "stock change", "audit", "record"],
        blocks: [
          { type: "p", text: "Open Inventory → History to see the most recent stock movements: what changed, how much, why (sale, refund, adjustment, purchase, opening stock, QR order or QR release), which receipt or order it relates to, and the resulting stock level." },
          { type: "note", tone: "tip", text: "Stock history is capped at the most recent 3,000 movements. Export or review regularly if you keep a very busy inventory." },
        ],
      },
    ],
  },

  // ── Sales (Transactions) ─────────────────────────────────────────────────
  {
    id: "sales",
    label: "Sales",
    blurb: "Review past sales, understand details and handle refunds.",
    articles: [
      {
        slug: "view-and-search-sales",
        title: "Viewing and Searching Sales",
        description: "Find any transaction in Transactions.",
        keywords: ["transactions", "view", "search", "filter", "date", "source", "export"],
        blocks: [
          { type: "steps", title: "Find a sale", steps: [
            "Open Transactions.",
            "Search by receipt number, customer name or cashier name.",
            "Filter by date range (Today, Yesterday, Last 7 days, Last 30 days).",
            "Filter by status (All / Completed / Refunded) and by source (All / In-store / QR).",
          ]},
          { type: "p", text: "Cashiers only see their own transactions; owners and managers see everyone's. The screen shows the total taken and refunded in the current view." },
          { type: "steps", title: "Export a list", steps: [
            "Apply the filters you want.",
            "Press Export CSV.",
            "A CSV file of the current filtered list downloads.",
          ]},
        ],
      },
      {
        slug: "sale-detail",
        title: "Understanding a Sale Detail",
        description: "Everything stored for one transaction.",
        keywords: ["detail", "items", "discount", "tax", "total", "paid", "change", "note"],
        blocks: [
          { type: "p", text: "Tap any transaction to open its receipt record: every item with unit price and any line promotion, then subtotal, discounts, points redeemed, tax, total, amount paid and change due, plus the note if there was one." },
          { type: "note", tone: "info", text: "Refunds show the original receipt with a REFUNDED mark, the cashier and the time of refund. QR-source sales show a QR badge." },
        ],
      },
      {
        slug: "refund-a-sale",
        title: "How to Refund a Sale",
        description: "Void a completed transaction and optionally return stock.",
        keywords: ["refund", "void", "return", "restock", "large refund"],
        minAccess: can.refund,
        blocks: [
          { type: "steps", title: "Refund a sale", steps: [
            "Open Transactions and find the sale.",
            "Open the sale detail.",
            "Press Refund (only completed sales can be refunded).",
            "Decide whether to Return items to stock — leave this on unless the goods are damaged and can't be resold.",
            "Confirm.",
          ]},
          { type: "list", title: "What happens", items: [
            "The transaction is marked refunded and kept in history.",
            "If restocked, each item's stock is returned to the shelf and recorded in stock history.",
            "The customer's spending, purchase count and loyalty points are rolled back (when a customer was attached).",
            "Refunds over the threshold in Settings (e.g. $150) raise a large-refund notification so management sees it.",
          ]},
          { type: "note", tone: "warn", title: "Permissions", text: "Only owners and managers can refund. Cashiers see refunds that happened but can't issue new ones." },
        ],
      },
      {
        slug: "what-happens-after-a-sale",
        title: "What Happens After a Sale",
        description: "Stock, reports, customers and notifications all update automatically.",
        keywords: ["stock", "inventory", "report", "customer", "points", "after sale"],
        blocks: [
          { type: "steps", title: "Automatic updates", steps: [
            "Stock — every item sold is subtracted from inventory.",
            "Sold counts — each product's sold total increases, feeding reports.",
            "Customer — the customer (if attached) records another visit, more spending and loyalty points.",
            "Reports — revenue, profit, product stats and employee stats pick up the sale.",
            "Notifications — products that fall to low stock or zero raise an alert.",
          ]},
          { type: "note", tone: "warn", title: "QR orders are different", text: "QR orders reserve stock when the customer places the order, not when staff complete it. That's why stock appears reserved while an order sits in the kitchen queue." },
        ],
      },
    ],
  },

  // ── Customers ────────────────────────────────────────────────────────────
  {
    id: "customers",
    label: "Customers",
    blurb: "Customer profiles, history, loyalty and store credit.",
    articles: [
      {
        slug: "customer-profiles",
        title: "Customer Profiles",
        description: "Create and use customer records at the register.",
        keywords: ["customer", "profile", "create", "edit", "history", "contact"],
        blocks: [
          { type: "steps", title: "Add a customer", steps: [
            "Open Customers.",
            "Press Add Customer.",
            "Enter the name (required), phone, email, address, and any notes (e.g. allergies) visible to cashiers at checkout.",
            "Save.",
          ]},
          { type: "p", text: "Tap a customer to open their profile: contact details, visits, total spent, average purchase, loyalty panel, store credit and their last 20 transactions." },
          { type: "note", tone: "info", text: "Customers can't be deleted once they have purchase history — their records keep receipts accurate. Customers without history can be removed permanently." },
        ],
      },
      {
        slug: "loyalty-points-and-tiers",
        title: "Loyalty Points and Tiers",
        description: "How points are earned, redeemed and how tiers give perks.",
        keywords: ["loyalty", "points", "redeem", "tier", "bronze", "silver", "gold", "earn"],
        blocks: [
          { type: "p", text: "When loyalty is enabled in Settings, every sale by a linked customer earns points, and points can be redeemed for money off." },
          { type: "list", title: "Example defaults (configurable)", items: [
            "Earn: 1 point per $10 spent (the earn rate is a setting).",
            "Redeem: 100 points = $1 off (redeem rate is a setting).",
            "Tiers: Bronze (no perk), Silver from $300 lifetime (2% off), Gold from $1,200 (5% off).",
          ]},
          { type: "note", tone: "tip", text: "At the register, attach the customer, pick their tier badge to apply their perk, and redeem points in Discount — the value is explained before you confirm." },
        ],
      },
      {
        slug: "store-credit",
        title: "Store Credit",
        description: "Give customers in-store credit for future purchases.",
        keywords: ["store credit", "credit", "balance", "adjust"],
        minAccess: can.products,
        blocks: [
          { type: "steps", title: "Adjust store credit", steps: [
            "Open a customer profile.",
            "Press the store credit / adjust button (owners and managers only).",
            "Enter the amount — use a negative number to take credit away.",
            "Add a short reason (required).",
            "Save.",
          ]},
          { type: "p", text: "The balance can't go below zero, and every change is recorded in the activity log with the reason." },
        ],
      },
    ],
  },

  // ── Suppliers ────────────────────────────────────────────────────────────
  {
    id: "suppliers",
    label: "Suppliers",
    blurb: "Who you buy from, and how products link to them.",
    articles: [
      {
        slug: "add-a-supplier",
        title: "How to Add a Supplier",
        description: "Create the companies you purchase stock from.",
        keywords: ["supplier", "add", "vendor", "contact person", "phone"],
        minAccess: can.suppliers,
        blocks: [
          { type: "steps", title: "Add a supplier", steps: [
            "Open Suppliers.",
            "Press Add Supplier.",
            "Enter the company name (required) and contact details — person, phone, email, address, notes (e.g. “Weekly Tuesday deliveries”, “Minimum order $300”).",
            "Save.",
          ]},
          { type: "note", tone: "info", text: "Suppliers matter most for purchase orders: every purchase order belongs to a supplier, and each product can be linked to the supplier you usually buy it from." },
        ],
      },
      {
        slug: "supplier-details",
        title: "Supplier Details",
        description: "See contact info, linked products and jump into a purchase order.",
        keywords: ["supplier", "detail", "products supplied", "purchase order"],
        minAccess: can.suppliers,
        blocks: [
          { type: "p", text: "Open a supplier to see their details, the products linked to them, and a Create purchase order shortcut that takes you to the Purchase Orders page." },
          { type: "note", tone: "warn", title: "Deleting a supplier", text: "Deleting a supplier keeps past purchase orders in history but unlinks their products automatically (they remain sellable)." },
        ],
      },
    ],
  },

  // ── Purchase Orders ──────────────────────────────────────────────────────
  {
    id: "purchase-orders",
    label: "Purchase Orders",
    blurb: "Order stock from suppliers and receive it into inventory.",
    articles: [
      {
        slug: "what-is-a-purchase-order",
        title: "What Is a Purchase Order?",
        description: "The difference between buying stock and selling to customers.",
        keywords: ["purchase order", "po", "stock", "supplier", "inventory", "buy"],
        minAccess: can.purchases,
        blocks: [
          { type: "p", text: "A Purchase Order (PO) is how you order stock from a supplier. It is completely different from a customer sale — it moves goods INTO your inventory instead of out, and it appears in purchasing reports rather than revenue." },
          { type: "p", text: "The flow is: choose a supplier → add products with quantities and costs → mark the order as ordered (sent to the supplier) → when the goods arrive, mark it received → stock is added to inventory automatically." },
          { type: "links", label: "Next steps", items: [
            { label: "Create a purchase order", to: "create-a-purchase-order" },
            { label: "Purchase order statuses", to: "purchase-order-statuses" },
          ]},
        ],
      },
      {
        slug: "create-a-purchase-order",
        title: "How to Create a Purchase Order",
        description: "Draft, add items and send the order to the supplier.",
        keywords: ["create", "draft", "order", "items", "supplier", "cost", "po"],
        minAccess: can.purchases,
        blocks: [
          { type: "steps", title: "Create and send a PO", steps: [
            "Open Purchase Orders.",
            "Press New Purchase Order.",
            "Choose the supplier. If you have no suppliers yet, add them on the Suppliers page first.",
            "Search and add products. The first time you add a product, the quantity defaults to at least its low-stock threshold and the cost defaults to its current cost.",
            "Adjust quantities and unit costs per line — the estimated cost updates live under the list.",
            "Optional: add an order note.",
            "Press Mark as ordered to send it to the supplier, or Save draft to keep working on it later.",
          ]},
          { type: "note", tone: "info", title: "Draft vs. ordered", text: "Drafts stay in the Draft tab and can still be edited. When you mark an order as ordered it moves to the Ordered tab, shows “In transit” in the menu, and raises a notification reminding you to check for delivery." },
          { type: "note", tone: "warn", title: "Editing stops once ordered", text: "Only draft orders can be edited. An ordered order can be cancelled if the supplier can't fulfil it, but its contents are final." },
        ],
      },
      {
        slug: "purchase-order-statuses",
        title: "Purchase Order Statuses",
        description: "Draft, ordered, received, cancelled — what each means.",
        keywords: ["status", "draft", "ordered", "received", "cancelled", "paid", "transit"],
        minAccess: can.purchases,
        blocks: [
          { type: "table", head: ["Status", "Meaning", "What you can do"], rows: [
            ["Draft", "Being written. The only state you can edit.", "Edit, send (Mark as ordered), cancel, delete."],
            ["Ordered", "Sent to the supplier, awaiting delivery.", "Cancel (if the supplier can't fulfil), or Mark as received when the goods arrive."],
            ["Received", "Stock has been added to inventory.", "Mark as paid / unpaid once the invoice is settled."],
            ["Cancelled", "Stopped (draft or ordered). Kept in history.", "Nothing — view only."],
          ]},
          { type: "note", tone: "tip", text: "The paid flag feeds the “Stock paid” line in Reports — mark a received order as paid when you settle the supplier invoice so cash-flow reporting stays truthful." },
        ],
      },
      {
        slug: "receive-stock",
        title: "Receiving Stock",
        description: "What happens the moment goods arrive.",
        keywords: ["receive", "received", "goods", "arrived", "stock added", "landed cost"],
        minAccess: can.purchases,
        blocks: [
          { type: "steps", title: "Receive an order", steps: [
            "Open the ordered purchase order.",
            "Press Mark as received once the goods arrive.",
          ]},
          { type: "list", title: "On receive, the system", items: [
            "Adds each product's quantity to its stock level.",
            "Updates each product's cost to the order's unit cost (latest landed cost).",
            "Records a “purchase” stock movement for every line, referenced by PO number.",
            "Raises a “Stock received” notification.",
            "Re-checks low-stock alerts for the received products.",
          ]},
          { type: "note", tone: "danger", title: "Only from Ordered", text: "Only orders that were marked as ordered can be received. The app blocks invalid status changes with an explanatory message." },
        ],
      },
    ],
  },

  // ── Reports & Profit ─────────────────────────────────────────────────────
  {
    id: "reports",
    label: "Profit & Reports",
    blurb: "Sales, profit, timeline, products, inventory, purchases, employees and payments.",
    articles: [
      {
        slug: "reports-overview",
        title: "Reports Overview",
        description: "The eight report categories and every preset time range.",
        keywords: ["reports", "categories", "preset", "today", "yesterday", "7d", "30d", "export csv"],
        minAccess: can.reports,
        blocks: [
          { type: "p", text: "Reports organizes analysis into eight tabs so you can jump between data quickly. Every tab respects the time range you select." },
          { type: "list", title: "Tabs", items: [
            "Sales — revenue and sales count for the period.",
            "Profit — gross and net profit built from revenue, costs, expenses and refunds.",
            "All-in-one — a combined daily chart of sales, gross profit, net profit, COGS, stock purchased, stock paid and expenses.",
            "Products — what sold and which items made the most profit.",
            "Inventory — current valuation and stock health.",
            "Purchases — received orders, what you paid for stock, by supplier and product.",
            "Employees — who made the sales and how many refunds each handled.",
            "Payments — revenue split by cash / card / mobile / other.",
          ]},
          { type: "steps", title: "Choose a period and export", steps: [
            "Pick Today, Yesterday, Last 7 days or Last 30 days.",
            "All tabs update to that range.",
            "Press Export CSV on any tab to download the data.",
          ]},
        ],
      },
      {
        slug: "profit-explained",
        title: "How Profit Is Calculated",
        description: "The difference between revenue, cost of goods, gross profit, expenses and net profit.",
        keywords: ["profit", "gross", "net", "revenue", "cogs", "cost of goods", "expenses", "margin"],
        minAccess: can.reports,
        blocks: [
          { type: "table", head: ["Term", "How it is calculated"], rows: [
            ["Revenue", "Sum of completed sale totals in the period."],
            ["Cost of goods sold (COGS)", "For each item sold, its recorded unit cost × quantity."],
            ["Gross profit", "Revenue − COGS − discounts."],
            ["Expenses", "Expenses logged in the period (rent, salaries, utilities, etc.)."],
            ["Refunds", "Totals of transactions refunded in the period."],
            ["Net profit", "Gross profit − expenses − refunds."],
          ]},
          { type: "p", text: "The same figures drive the Dashboard. Product-level profit is (price − cost) × quantity − line discount per product." },
          { type: "note", tone: "info", title: "Profit margin you see in Products", text: "The margin column in Products is the markup between cost and selling price — it does not include discounts, which only appear on actual sales." },
        ],
      },
      {
        slug: "expenses",
        title: "Tracking Expenses",
        description: "Log rent, salaries, utilities and more so profit reporting is accurate.",
        keywords: ["expense", "rent", "salaries", "utilities", "cost", "receipt attachment"],
        minAccess: can.expenses,
        blocks: [
          { type: "steps", title: "Log an expense", steps: [
            "Open Expenses.",
            "Press Log Expense.",
            "Enter the date (not in the future), amount and what it was for (required).",
            "Pick a category (Rent, Utilities, Salaries, Supplies, Repairs, Marketing, Other) and how it was paid.",
            "Optional: attach a receipt image or PDF (under 400 KB) and add notes.",
            "Save.",
          ]},
          { type: "p", text: "Expenses feed straight into the profit figures in Reports, so regular logging keeps your net profit honest. You can export expenses to CSV and delete mistakes." },
        ],
      },
      {
        slug: "promotions",
        title: "Promotions (Deals)",
        description: "Percent off, fixed amount off and Buy X Get Y, across the order, a category or a product.",
        keywords: ["promotion", "deal", "coupon", "bogo", "percent", "fixed", "discount", "auto apply"],
        minAccess: can.promotions,
        blocks: [
          { type: "list", title: "Deal types", items: [
            "Percent off — e.g. 20% off.",
            "Fixed amount off — e.g. $2 off.",
            "Buy X Get Y — e.g. 2 for 1.",
          ]},
          { type: "list", title: "Scope", items: [
            "Whole order — the deal applies to the entire basket.",
            "Category — every qualifying product in a category.",
            "Product — a single product only.",
          ]},
          { type: "p", text: "Deals either apply automatically, require a coupon code the customer presents, or are applied manually. You can set a minimum order and a date range so a deal only runs when you want it (e.g. a weekend special)." },
          { type: "note", tone: "info", text: "Paused deals stop applying to new sales immediately. Past transactions keep their discounts." },
        ],
      },
    ],
  },

  // ── Staff & Permissions ──────────────────────────────────────────────────
  {
    id: "staff",
    label: "Staff & Permissions",
    blurb: "Roles, employees, sign-in and the activity log.",
    articles: [
      {
        slug: "roles-and-permissions",
        title: "Roles & Permissions",
        description: "What owners, managers and cashiers can and can't do.",
        keywords: ["roles", "permissions", "admin", "owner", "manager", "cashier", "access", "capabilities"],
        blocks: [
          { type: "table", head: ["Capability", "Owner / Admin", "Manager", "Cashier"], rows: [
            ["Make sales", "✓", "✓", "✓"],
            ["Manage customers", "✓", "✓", "✓"],
            ["Refund transactions", "✓", "✓", "—"],
            ["Manage products", "✓", "✓", "—"],
            ["Adjust inventory", "✓", "✓", "—"],
            ["Manage suppliers / purchases", "✓", "✓", "—"],
            ["Promotions / expenses", "✓", "✓", "—"],
            ["QR ordering management", "✓", "✓", "—"],
            ["Reports & profit", "✓", "✓", "—"],
            ["Manage employees", "✓", "—", "—"],
            ["Business settings", "✓", "—", "—"],
            ["View transactions", "All", "All", "Own only"],
            ["Max manual discount", "100%", "30%", "10%"],
          ]},
          { type: "note", tone: "info", title: "Hidden beats blocked", text: "Pages you can't use are hidden from your menu, and the system re-checks permissions on every action — so a cashier can't work around the interface to manage stock or settings." },
          { type: "note", tone: "warn", title: "Discount caps are enforced", text: "The pricing engine refuses a manual discount above your role's cap, even if one is typed in." },
        ],
      },
      {
        slug: "add-an-employee",
        title: "How to Add an Employee",
        description: "Create accounts with usernames and PINs.",
        keywords: ["employee", "staff", "add", "username", "pin", "account", "create"],
        minAccess: can.employees,
        blocks: [
          { type: "steps", title: "Add a team member", steps: [
            "Open Employees → Team.",
            "Press Add employee.",
            "Enter their full name and a username (lowercase, no spaces) used to sign in.",
            "Pick their role — the access summary under the selector explains each one.",
            "Set a 4–6 digit PIN. If you leave it blank, a 4-digit PIN is generated and shown in the confirmation.",
            "Optionally add phone and email, then Save.",
          ]},
          { type: "p", text: "Inactive employees can't sign in — use the deactivate switch instead of deleting an account that might return. The very first owner account can't be deactivated." },
          { type: "note", tone: "danger", title: "Keep PINs private", text: "The PIN is the key to the register. Share it with the employee directly, and reset it from this page if it's ever at risk. It's stored as a secure hash, never as readable text." },
        ],
      },
      {
        slug: "activity-log",
        title: "Activity Log",
        description: "Who did what, when — sign-ins, sales and big changes.",
        keywords: ["activity", "log", "audit", "history", "who", "actions"],
        blocks: [
          { type: "p", text: "Employees → Activity log records the most recent 200 actions: staff sign-ins and sign-outs, completed sales, refunds, product changes, stock adjustments, purchase orders, customers, suppliers, promotions, expenses and settings changes." },
          { type: "p", text: "Use the filter to focus on one activity type (sign-ins, inventory, purchases, and so on). Every entry shows who did it, what they did, and relative time." },
          { type: "note", tone: "tip", text: "The log is read-only for everyone. It's a safety net — if stock or money looks wrong, check here first." },
        ],
      },
    ],
  },

  // ── Customer QR Ordering ─────────────────────────────────────────────────
  {
    id: "qr-ordering",
    label: "Customer QR Ordering",
    blurb: "Let customers scan, order and pay from their own phones.",
    articles: [
      {
        slug: "how-qr-ordering-works",
        title: "How QR Ordering Works",
        description: "The full customer journey from scan to sale.",
        keywords: ["qr", "order", "scan", "customer", "phone", "self order", "flow"],
        blocks: [
          { type: "steps", title: "The journey", steps: [
            "You create QR codes (one per table or location) and print posters.",
            "A customer scans the code with their phone camera and the menu opens in their browser — inside your store, not on your staff app.",
            "They add products and submit the order, optionally entering a name and note.",
            "You see a new QR order in Customer Orders (with a chime if sound is on), with the location label.",
            "You accept, prepare it, mark it ready, then complete it and take payment.",
            "Completing the order turns it into a real transaction in your sales history and Reports.",
          ]},
          { type: "note", tone: "danger", title: "Customers never see the staff app", text: "QR ordering runs on a separate public page. Customers cannot see your dashboard, products beyond the menu, prices' cost, stock levels or business data." },
          { type: "note", tone: "info", title: "Stock is reserved at order time", text: "When a customer places an order, the items are reserved (deducted) from stock immediately so you don't oversell. If the order is rejected or cancelled, the stock is automatically returned." },
        ],
      },
      {
        slug: "create-qr-codes-and-print-posters",
        title: "Creating QR Codes and Printing Posters",
        description: "Build codes for tables and walls, then print or download them.",
        keywords: ["qr code", "create", "print", "poster", "png", "link", "table"],
        minAccess: can.qr,
        blocks: [
          { type: "steps", title: "Create a code and put it up", steps: [
            "Open QR Ordering.",
            "Press New QR Code.",
            "Give the location a name (e.g. “Table 12” — new codes auto-number as Table 1, Table 2…).",
            "Make sure it's Active.",
            "Save, then open the card to Print poster, download a PNG, or copy the link.",
            "Place the poster on the table or wall. Test it with your own phone first.",
          ]},
          { type: "p", text: "QR code addresses are permanent — they keep working across reloads and redeploys, and relabeling a code doesn't break old posters." },
          { type: "note", tone: "warn", title: "Testing on your phone matters", text: "If the app runs only on this machine (localhost) a printed code won't open anywhere else. Set your public website address in Settings → QR Ordering and re-print before putting codes in front of customers." },
        ],
      },
      {
        slug: "table-vs-counter",
        title: "Table Service vs. Counter Service",
        description: "The mode that decides how the customer menu is worded.",
        keywords: ["table", "counter", "service mode", "pickup", "pay at table", "settings"],
        minAccess: can.qr,
        blocks: [
          { type: "list", title: "Two modes in Settings → QR Ordering", items: [
            "Table mode — the page says “Order from your table” and “Pay at your table when the order arrives”. Use it when you deliver to tables.",
            "Counter mode — the page says “Order for pickup” and “Pay at the counter when you collect”. Use it for counter pickup.",
          ]},
          { type: "note", tone: "info", text: "The mode only changes what the customer sees. Staff handling is identical in Customer Orders either way." },
        ],
      },
      {
        slug: "handle-qr-orders",
        title: "Handling QR Orders as Staff",
        description: "Accept, reject, prepare, mark ready and complete orders.",
        keywords: ["customer orders", "accept", "reject", "preparing", "ready", "complete", "payment", "new"],
        minAccess: can.qr,
        blocks: [
          { type: "table", head: ["Stage", "What to do"], rows: [
            ["New", "Open the order, check items and location. Accept order, or Reject if you can't fulfil it (stock goes back automatically)."],
            ["Accepted", "Press Start preparing when you begin."],
            ["Preparing", "Press Mark ready when it's ready to serve."],
            ["Ready", "Press Complete & take payment, choose the payment method, and the order becomes a sale."],
            ["Completed", "End of flow — a receipt link is available from the order detail."],
          ]},
          { type: "note", tone: "tip", title: "New orders alert you", text: "New orders appear instantly with a notification and a chime (when enabled). The bell at the top of the screen counts them." },
          { type: "note", tone: "warn", text: "Orders can't be completed before they're ready, and invalid status jumps are stopped with a clear message." },
        ],
      },
    ],
  },

  // ── Tables / QR Tables ───────────────────────────────────────────────────
  {
    id: "tables",
    label: "Tables / QR Tables",
    blurb: "Name codes like tables, print posters, and serve table orders.",
    articles: [
      {
        slug: "table-setup",
        title: "Setting Up Tables",
        description: "Turn QR codes into table numbers customers order from.",
        keywords: ["table", "setup", "qr", "poster", "place", "location"],
        blocks: [
          { type: "p", text: "A “table” in NovaPOS is just a QR code whose location label you can read at a glance — Table 1, Table 2, or names like “Patio” or “Bar”. New codes number themselves automatically." },
          { type: "steps", title: "Set up a table", steps: [
            "Open QR Ordering and create a code named for the table.",
            "Print the poster and place it where it can't be missed (standing menu or table tent).",
            "Test by scanning with a phone that isn't your staff account.",
            "When an order arrives, the location label tells you exactly which table placed it.",
          ]},
          { type: "note", tone: "info", text: "Relabeling a table later doesn't change its URL — old posters still work, which also means you should update signage when you rename." },
        ],
      },
    ],
  },

  // ── Notifications / Chat / Voice Notes ───────────────────────────────────
  {
    id: "chat-notifications",
    label: "Notifications & Chat",
    blurb: "In-app alerts, team chat, presence and voice notes.",
    articles: [
      {
        slug: "notifications",
        title: "Notifications",
        description: "What the bell is telling you.",
        keywords: ["bell", "notification", "unread", "low stock", "refund", "orders", "read"],
        blocks: [
          { type: "p", text: "The bell in the top bar collects system alerts. Open the Notifications page to filter to unread items, mark everything read, or delete entries." },
          { type: "table", head: ["Type", "Example"], rows: [
            ["Low stock / Out of stock", "“Espresso Beans 1kg is down to 4 units.” — appears after sales, stock changes and deliveries."],
            ["Purchase order sent", "“PO-00012 is awaiting delivery.”"],
            ["Stock received", "“PO-00012 arrived — inventory updated for 3 products.”"],
            ["Large refund", "“TXN-00088 was refunded ($160) by Sam.”"],
            ["New QR order", "“ORD-1042 · Table 3 · 2 items.”"],
            ["System", "QR orders rejected or cancelled by customers (stock returned)."],
          ]},
          { type: "note", tone: "tip", text: "Clicking a notification jumps straight to the relevant page (inventory, purchase orders, transactions or orders)." },
        ],
      },
      {
        slug: "staff-chat",
        title: "Staff Chat",
        description: "Message your team, see who's on shift, and call attention with @mentions.",
        keywords: ["chat", "message", "dm", "mention", "typing", "presence", "online", "staff"],
        blocks: [
          { type: "list", title: "Features", items: [
            "Staff-wide channel — talk to everyone on shift.",
            "Direct messages — private 1-on-1 chats with any active teammate.",
            "Presence — a signal panel shows who is online, away or offline.",
            "Typing indicators — see when someone is replying.",
            "@mentions — type @ and pick a teammate to get their attention; mentions are highlighted in the chat.",
            "Unread badges — the sidebar and chat list show unopened conversations.",
            "Search — find text within the loaded conversation.",
          ]},
          { type: "steps", title: "Send a message", steps: [
            "Open Staff Chat.",
            "Pick Staff-wide or a teammate.",
            "Type, then press Enter (Shift+Enter for a new line).",
            "When it's been read, your bubble shows “Seen”.",
          ]},
          { type: "note", tone: "info", text: "Chat needs the server connection. If you're offline the app says “Offline” and retries automatically; unsent messages offer a Retry button." },
        ],
      },
      {
        slug: "voice-notes",
        title: "Voice Notes",
        description: "Record and send short audio messages to your team.",
        keywords: ["voice", "audio", "record", "message", "mic", "playback"],
        blocks: [
          { type: "steps", title: "Record a voice note", steps: [
            "Open the chat conversation and press the microphone button.",
            "Talk — the timer counts up to a 2-minute maximum.",
            "Press Send (it's disabled until you've recorded at least 0.6 seconds).",
            "Receivers tap the bubble to play it.",
          ]},
          { type: "note", tone: "warn", title: "Microphone blocked?", text: "Allow microphone permission in the browser, or voice notes won't record. If your team account can't record, check whether the browser routed the correct microphone." },
          { type: "note", tone: "danger", title: "Only where configured", text: "Voice notes require voice storage to be configured on the deployment (shown as available in signal info). If it isn't, the mic is hidden and there's nothing to troubleshoot on your side." },
        ],
      },
    ],
  },

  // ── Settings ─────────────────────────────────────────────────────────────
  {
    id: "settings",
    label: "Settings",
    blurb: "Business profile, currency, tax, receipts, payments, loyalty, QR and data.",
    articles: [
      {
        slug: "settings-overview",
        title: "Settings Overview",
        description: "Every tab in Settings and what it controls.",
        keywords: ["settings", "tabs", "configure", "manage"],
        minAccess: can.settings,
        blocks: [
          { type: "p", text: "Settings controls the whole system. It's a series of tabs; the QR Ordering tab also requires QR management permission." },
          { type: "table", head: ["Tab", "Controls"], rows: [
            ["Business", "Business name, address, phone, email and logo — shown on receipts and posters."],
            ["Currency", "Currency code and symbol used for all money."],
            ["Tax", "Tax on/off and the rate applied to sales."],
            ["Receipts", "The footer text printed on every receipt."],
            ["Payments", "Which payment methods the POS offers at checkout."],
            ["Loyalty", "Points earning, redemption value, and customer tiers."],
            ["QR Ordering", "QR ordering on/off, table vs. counter mode, customer fields, sound and public website address."],
            ["Appearance", "Light or dark theme."],
            ["Data", "Backup download, restore, demo data and fresh-start tools."],
          ]},
          { type: "note", tone: "info", title: "Permission required", text: "Only owners can change settings. When an owner changes a setting, everyone's screen updates." },
        ],
      },
      {
        slug: "data-and-backups",
        title: "Backup and Data",
        description: "Download, restore and reset your data safely.",
        keywords: ["backup", "restore", "export", "demo data", "reset", "upload", "data"],
        minAccess: can.settings,
        blocks: [
          { type: "list", title: "In Settings → Data", items: [
            "Backup — downloads everything as a JSON file. Keep a copy somewhere safe.",
            "Restore — loads a previously downloaded backup.",
            "Demo data — loads the sample cafe for safe exploration.",
            "Upload to server — sends this browser's local data to the shared server (used when moving from offline single-device to server mode).",
            "Start fresh — begins a brand new, empty business.",
          ]},
          { type: "note", tone: "danger", title: "What backs up", text: "Backups include products, sales, customers, stock history, settings and everything else. They don't include chat messages or voice notes, which are stored separately with the server." },
        ],
      },
    ],
  },

  // ── Account & Security ───────────────────────────────────────────────────
  {
    id: "account-security",
    label: "Account & Security",
    blurb: "Passwords, PINs, sessions and keeping business data safe.",
    articles: [
      {
        slug: "account-security",
        title: "Account & Security",
        description: "How sign-in security works and how to protect the register.",
        keywords: ["security", "pin", "password", "session", "protect", "privacy", "lockout"],
        blocks: [
          { type: "list", title: "How it works", items: [
            "Every employee has a username and a PIN chosen by the owner.",
            "PINs are stored as secure hashes — the app never shows them back.",
            "Repeated wrong PINs temporarily lock an account to slow brute-force attempts.",
            "Sessions last while you're signed in; signing out returns to the login screen.",
            "Only owners can change settings, manage employees, and access backup/restore.",
          ]},
          { type: "steps", title: "Protect the business", steps: [
            "Never share your PIN; reset it if it's ever shared.",
            "Sign out before leaving the register unattended.",
            "Use an owner account only for owner tasks.",
            "Keep your backups (Settings → Data) in a safe place.",
          ]},
          { type: "note", tone: "danger", title: "No secrets in Help", text: "This guide deliberately never shows real passwords, keys or connection details. Never share your server URLs or login tokens with anyone." },
        ],
      },
    ],
  },

  // ── Troubleshooting ──────────────────────────────────────────────────────
  {
    id: "troubleshooting",
    label: "Troubleshooting",
    blurb: "Fix common problems step by step.",
    articles: [
      {
        slug: "cant-sign-in",
        title: "Can't Sign In",
        description: "Wrong PIN, locked account, or account missing from the list.",
        keywords: ["sign in", "pin", "lockout", "login", "error", "forgot"],
        blocks: [
          { type: "probe", problem: "Your name doesn't appear in the sign-in list, or the PIN is rejected.", cause: "The username field didn't match, the PIN is wrong, the account is inactive, or too many wrong attempts locked it temporarily.", fix: [
            "Confirm you typed the username correctly (it's case-insensitive, so no capitals needed).",
            "Try the PIN again carefully — digits only, 4–6 characters.",
            "If the account was deactivated, an owner must reactivate it in Employees.",
            "If the account is temporarily locked, wait 15 minutes before retrying.",
          ], admin: "If you've never changed the PIN, ask an owner to reset it from Employees → edit the employee → Reset PIN." },
        ],
      },
      {
        slug: "product-not-appearing",
        title: "A Product Isn't Appearing",
        description: "New or edited products don't show in the POS.",
        keywords: ["product", "missing", "not showing", "hidden", "archived"],
        blocks: [
          { type: "probe", problem: "A product that should be sellable doesn't appear in New Sale or search.", cause: "The product is archived, it's beyond the top result cap in the grid, or a search term doesn't match.", fix: [
            "Open Products and check the status — archived products are hidden from the POS.",
            "Check the category filter isn't hiding it in the POS grid (use All).",
            "Search by name, SKU or barcode — remember the grid shows the most common 60; search finds the rest.",
          ], admin: "If it should be active, an owner/manager can re-activate it from Products." },
        ],
      },
      {
        slug: "stock-looks-wrong",
        title: "Stock Looks Incorrect",
        description: "Inventory levels don't match what's on the shelf.",
        keywords: ["stock", "wrong", "inventory", "discrepancy", "history"],
        blocks: [
          { type: "probe", problem: "A product's stock level doesn't match reality.", cause: "An unrecorded sale, an unsaved adjustment, a cancelled QR order, or an error in an earlier stock adjustment.", fix: [
            "Open Inventory → History and review every movement for the product (sales, refunds, purchases, adjustments, QR orders).",
            "Compare the recorded history with what happened in the store.",
            "Correct the level with an Inventory adjustment using “Set” and a clear reason.",
            "Check for active QR orders on the product — their stock is reserved until completed, rejected or cancelled.",
          ], admin: "If history is missing or order cancellations aren't returning stock, contact the person who manages the server." },
        ],
      },
      {
        slug: "sale-wont-complete",
        title: "A Sale Won't Complete",
        description: "The POS refuses to finish the sale.",
        keywords: ["sale", "complete", "error", "payment", "discount", "stock"],
        blocks: [
          { type: "probe", problem: "Pressing complete shows an error instead of finishing the sale.", cause: "One of the validations fired: not enough stock, an invalid discount cap, a disabled payment method, or cash received less than the total.", fix: [
            "Read the exact message — the app states the reason (e.g. “Not enough stock for X. Only 2 left.”).",
            "Reduce the quantity of that item or skip it.",
            "Check the manual discount isn't above your role's limit.",
            "Confirm the payment method is enabled in Settings → Payments.",
            "For cash, enter at least the total — the change is calculated for you.",
          ], admin: "If every sale fails with no clear reason, check the server connection (see Network issues) and that payment methods are enabled." },
        ],
      },
      {
        slug: "customer-order-not-appearing",
        title: "A Customer Order Isn't Appearing",
        description: "You expected a QR order but nothing arrived.",
        keywords: ["qr order", "customer", "missing", "not appearing", "scan"],
        blocks: [
          { type: "probe", problem: "A customer says they ordered, but no new order shows in Customer Orders.", cause: "The order was placed against a paused/removed code, QR ordering is off, stock made the cart unavailable, or the customer's phone lost connection mid-order.", fix: [
            "Refresh Customer Orders — new orders arrive instantly when connected.",
            "Confirm QR ordering is enabled in Settings → QR Ordering.",
            "Check the code is Active in QR Ordering (paused codes show customers a closed notice).",
            "Have the customer try again with fewer items if a product's stock fell during their session.",
          ], admin: "If orders placed on a phone never sync to the staff screen, the server connection needs checking (see Network issues)." },
        ],
      },
      {
        slug: "qr-code-not-working",
        title: "A QR Code Isn't Working",
        description: "Customers scan but nothing opens, or the menu doesn't load.",
        keywords: ["qr", "code", "scan", "broken", "offline", "localhost"],
        blocks: [
          { type: "probe", problem: "Scanning the poster does nothing, or opens a page that doesn't load.", cause: "The app isn't published at a public address the customer's phone can reach, the code is paused, or the phone has no signal.", fix: [
            "Test the code with a phone that isn't logged in as staff.",
            "Confirm the code is Active.",
            "If the URL contains localhost, the app only runs on this machine — set your public website address in Settings → QR Ordering and re-print posters.",
            "Clean the poster or re-print if the QR is dirty or shiny.",
          ], admin: "If a public address is set and still failing, the deployment or domain needs the owner/server person." },
        ],
      },
      {
        slug: "dashboard-data-wrong",
        title: "Dashboard Data Looks Wrong",
        description: "Numbers don't match the register tape.",
        keywords: ["dashboard", "wrong", "data", "revenue", "report", "period"],
        blocks: [
          { type: "probe", problem: "Total, profit or counts don't look right.", cause: "The selected time range differs from what you expect, or a refund/expense/PO changed the figures since you last looked.", fix: [
            "Double-check the period — the header shows the exact range (e.g. “Today” vs “Last 7 days”).",
            "Remember profit subtracts expenses and refunds; revenue is before refunds.",
            "Verify recent transactions, refunds and expenses in their own pages.",
            "Check the growth badge compares to the previous identical period.",
          ], admin: "If totals don't add up even after reviewing transactions and expenses, reconcile against the activity log." },
        ],
      },
      {
        slug: "report-is-empty",
        title: "A Report Is Empty",
        description: "A report tab has no rows or zero values.",
        keywords: ["report", "empty", "no data", "csv"],
        blocks: [
          { type: "probe", problem: "A report shows nothing for the selected period.", cause: "There were no completed transactions, receipts, expenses or purchases in that range, or the data lives in a different period.", fix: [
            "Broader the time range (Last 30 days instead of Today).",
            "Confirm the record actually exists (e.g. a sale completed vs. a sale refunded) in its home page.",
            "Refunded transactions don't count as revenue — check the refunds figure instead.",
          ], admin: "If a sale you can see in Transactions never appears in any report range, ask the server owner to check data sync." },
        ],
      },
      {
        slug: "staff-member-cant-access",
        title: "A Staff Member Can't Access Something",
        description: "A page, action or report is missing for one user.",
        keywords: ["staff", "permission", "access", "hidden", "role", "cashier"],
        blocks: [
          { type: "probe", problem: "A teammate reports a missing menu item or a “You don't have permission” message.", cause: "Their role genuinely limits the feature, or their account needs a role change.", fix: [
            "Check the capability table under Staff & Permissions (e.g. cashiers see no refunds, reports or settings).",
            "If the business intent is different, an owner changes the role in Employees.",
            "Remember discount caps and sign-in lockouts are part of the same permission system.",
          ], admin: "Only owners can change roles. After changing a role, the teammate signs out and back in to refresh." },
        ],
      },
      {
        slug: "voice-note-wont-play",
        title: "A Voice Note Won't Play",
        description: "Message arrives but audio doesn't play.",
        keywords: ["voice", "audio", "play", "not playing", "mic"],
        blocks: [
          { type: "probe", problem: "A voice bubble shows but tapping it doesn't play sound.", cause: "The audio file can't be fetched (deployment lacks voice storage, deleted file, or a browser block).", fix: [
            "Check your device isn't muted and the volume is up.",
            "Retry the message — if the deployment removed the audio, the bubble shows an unavailable state.",
            "For recording problems, grant microphone permission in the browser.",
          ], admin: "If healthy voice notes consistently fail, the server's voice storage configuration needs attention." },
        ],
      },
      {
        slug: "page-not-loading",
        title: "A Page Isn't Loading",
        description: "Spinner never resolves, or a page is blank.",
        keywords: ["loading", "blank", "spinner", "freeze", "refresh"],
        blocks: [
          { type: "probe", problem: "The app hangs on a spinner or a screen stays blank.", cause: "A stuck network request, a transient app crash (especially on a long-lived tab), or the server is unreachable.", fix: [
            "Wait a moment for the app's built-in retries.",
            "Refresh the page (F5). Your session persists.",
            "Check your Wi-Fi/data connection.",
            "Close other tabs of the same app — it syncs across tabs.",
          ], admin: "If it only happens with the server connection active, check the server/network (see Network or server error)." },
        ],
      },
      {
        slug: "network-or-server-error",
        title: "Network or Server Error",
        description: "Messages about the server, offline mode, or sync failures.",
        keywords: ["server", "network", "offline", "sync", "connection", "up to date"],
        blocks: [
          { type: "probe", problem: "You see offline banners, “Sign in required”, sync statements or “This view is too far behind.”", cause: "The browser can't reach the server, the signed-in session expired, or another tab is far ahead of your view.", fix: [
            "Wait for automatic reconnection (the app polls every few seconds).",
            "Check the network, then sign out and back in if needed.",
            "If you see “too far behind”, refresh to catch up with the latest data.",
            "In offline / single-device mode everything is stored on the device and works without a server.",
          ], admin: "Persistent server errors mean the deployment needs checking — connection details live outside this app and must not be shared here." },
        ],
      },
    ],
  },

  // ── FAQ ──────────────────────────────────────────────────────────────────
  {
    id: "faq",
    label: "Frequently Asked Questions",
    blurb: "Quick answers to the most common questions.",
    articles: [
      {
        slug: "faq-general",
        title: "General FAQ",
        description: "What NovaPOS is and how the basics work.",
        keywords: ["faq", "what is", "general", "questions"],
        blocks: [
          { type: "list", title: "Q & A", items: [
            "What is NovaPOS? — A point-of-sale and business management system for market & cafe businesses: sales, inventory, suppliers, purchase orders, customers, staff, reports and QR self-ordering in one app.",
            "Where is my data stored? — On this device by default, with the option to connect to a shared server so multiple devices stay in sync. Backups are available in Settings → Data.",
            "Do I need the internet? — No. The app works fully offline on one device. The server connection adds live multi-device sync, staff chat, voice notes and QR phone orders.",
            "How do I open the register for the day? — Sign in, then use New Sale. Everything you need (search, categories, payment) is on that screen.",
            "Who can change settings? — Only owners. Managers run daily operations; cashiers sell.",
          ]},
        ],
      },
      {
        slug: "faq-sales-and-inventory",
        title: "Sales & Inventory FAQ",
        description: "Answers about purchases, stock, refunds and profit.",
        keywords: ["faq", "sale", "stock", "profit", "refund", "po"],
        blocks: [
          { type: "list", title: "Q & A", items: [
            "How do I make a sale? — New Sale → tap products → Complete sale → pick payment → done. See How to Make a Sale.",
            "How do I add a product? — Products → Add Product → name, prices, stock → save. See How to Add a Product.",
            "How do I change stock? — Open Inventory and use Add/Remove/Set adjustments, or receive a purchase order. See How to Adjust Stock.",
            "What is a purchase order? — A request for stock from a supplier that moves inventory in when received. See What Is a Purchase Order?",
            "How does profit get calculated? — Gross profit = revenue − cost of goods − discounts. Net profit = gross profit − expenses − refunds. See How Profit Is Calculated.",
            "Can I refund a sale? — Owners and managers can. The refund returns stock (optional) and rolls back the customer's history. See How to Refund a Sale.",
            "Why are some products archived rather than deleted? — Products with sales history are archived so receipts and reports stay accurate; they can be reactivated anytime.",
          ]},
        ],
      },
      {
        slug: "faq-qr-and-customers",
        title: "QR, Customers & Staff FAQ",
        description: "Customer ordering, loyalty, QR and roles.",
        keywords: ["faq", "qr", "customer", "loyalty", "staff", "roles"],
        blocks: [
          { type: "list", title: "Q & A", items: [
            "How does QR ordering work? — Customers scan a printed code, order from their phone, and staff fulfil it in Customer Orders. See How QR Ordering Works.",
            "Can customers access the staff dashboard? — No. QR ordering runs on a separate public page with only the menu, orders and their own session data.",
            "How do loyalty points work? — Customers linked to sales earn points that can be redeemed for money off, with tiers giving tier perks. See Loyalty Points and Tiers.",
            "Why can't I access a page? — Your role controls it. Check Roles & Permissions, then ask an owner if the role should change.",
            "How do I manage staff? — Employees → Team for names, usernames, PINs and roles; Activity log shows what people did. See How to Add an Employee.",
            "Do staff see my messages when I'm not in the room? — Chat shows who's online/away/offline, and messages stay until read.",
            "Is there a refund approval flow? — Refunds over the large-refund threshold raise a notification so management sees them, but any owner/manager can refund directly.",
          ]},
        ],
      },
    ],
  },

  // ── System Overview ──────────────────────────────────────────────────────
  {
    id: "system-overview",
    label: "System Overview",
    blurb: "How NovaPOS stores data, syncs devices and protects history.",
    articles: [
      {
        slug: "how-data-works",
        title: "How Your Data Works",
        description: "Storage, sync and the automatic history NovaPOS keeps.",
        keywords: ["storage", "sync", "server", "local", "device", "history", "limits"],
        blocks: [
          { type: "list", title: "Storage models", items: [
            "Single device — everything is stored locally in the browser and works without the internet.",
            "Shared server — devices stay in sync in near-real-time, and QR phone orders plus staff chat are available.",
          ]},
          { type: "list", title: "Automatic history", items: [
            "Stock history — the most recent 3,000 movements (sales, refunds, adjustments, purchases, QR orders).",
            "Activity log — the most recent 200 actions by staff.",
            "Notifications — the latest 200 alerts.",
            "Transactions — every completed sale and refund, kept forever.",
          ]},
          { type: "note", tone: "info", text: "Because every change is recorded, you can always answer “what happened to this stock?” with the history screens rather than guesswork." },
        ],
      },
      {
        slug: "customer-vs-staff",
        title: "Customer-Facing vs. Staff-Facing",
        description: "Two completely separate experiences in one system.",
        keywords: ["customer", "staff", "public", "private", "security", "separation"],
        blocks: [
          { type: "table", head: ["", "Customer (QR order page)", "Staff (NovaPOS app)"], rows: [
            ["Sees", "The menu, prices, their own orders and status.", "Dashboard, stock, profits, staff, and full management tools."],
["Can do", "Order, cancel a not-yet-started order, track status.", "Sell, manage inventory, refund sales, adjust prices and use every staff tool."],
            ["Sign in", "None - each phone gets a temporary customer session when it scans a code.", "Username and PIN set under Employees, per staff member."],
            ["Keeps", "Only its own orders and loyalty points.", "All business data: sales, customers, stock, reports and settings."],
          ]},
          { type: "note", tone: "info", title: "Same business, two doors", text: "Both sides read the same menu, prices and inventory. The customer page is public and limited to the customer's own orders; the staff app is private and protected by roles." },
          { type: "links", label: "Continue reading", items: [
            { label: "How QR ordering works", to: "/help/how-qr-ordering-works" },
            { label: "Signing in and signing out", to: "/help/signing-in-and-signing-out" },
            { label: "Roles and permissions", to: "/help/roles-and-permissions" },
          ]},
        ],
      },
    ],
  },
];

export function canSee(article: HelpArticle, p: Permissions): boolean {
  return !article.minAccess || article.minAccess(p);
}

export const ALL_ARTICLES: Array<HelpArticle & { categoryId: string }> =
  HELP_CATEGORIES.flatMap((c) => c.articles.map((a) => ({ ...a, categoryId: c.id })));

export function findArticle(
  slug: string
): (HelpArticle & { categoryId: string }) | undefined {
  return ALL_ARTICLES.find((a) => a.slug === slug);
}
