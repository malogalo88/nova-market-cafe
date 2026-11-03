import type { DB } from "./types";
import { fmtMoney, fmtDateTime, dayKey } from "./format";

export interface AIAssistantContext {
  db: DB;
  symbol: string;
  today: string;
}

/** Rule-based store assistant. Answers questions about local data without
 *  any external API. Extend with a real LLM backend later if desired. */
export class StoreAssistant {
  private db: DB;
  private symbol: string;
  private today: string;

  constructor({ db, symbol, today }: AIAssistantContext) {
    this.db = db;
    this.symbol = symbol;
    this.today = today;
  }

  /** Main entry point. Returns a plain-text answer. */
  answer(question: string): string {
    const q = question.trim().toLowerCase();

    // Greetings / help
    if (/^(hi|hello|hey|help|what can you do)/.test(q)) return this.help();

    // Revenue / sales
    if (q.includes("revenue") || q.includes("sales") || q.includes("how much did i make")) {
      return this.revenueAnswer(q);
    }

    // Top / best selling products
    if (q.includes("top") || q.includes("best") || q.includes("popular")) {
      if (q.includes("product") || q.includes("item") || q.includes("sell")) return this.topProductsAnswer();
    }

    // Low stock / inventory
    if (q.includes("low stock") || q.includes("out of stock") || q.includes("inventory") || q.includes("stock")) {
      return this.stockAnswer(q);
    }

    // Specific product lookup
    const productMatch = this.findProductMention(q);
    if (productMatch) return this.productAnswer(productMatch);

    // Customers
    if (q.includes("customer") || q.includes("clients")) return this.customersAnswer(q);

    // Transactions count
    if (q.includes("transaction") || q.includes("orders") || q.includes("sale count")) {
      return this.transactionsAnswer(q);
    }

    // Default fallback
    return this.help();
  }

  private help(): string {
    return `I can answer questions about your store. Try asking:
• "What's my revenue today?"
• "Which products are low on stock?"
• "What's my best selling product?"
• "Tell me about [product name]"
• "How many sales today?"`;
  }

  private revenueAnswer(q: string): string {
    const { transactions, settings } = this.db;
    const today = this.today;
    const salesToday = transactions.filter((t) => dayKey(t.date) === today && t.status === "completed");
    const revenueToday = salesToday.reduce((s, t) => s + t.total, 0);

    if (q.includes("today") || q.includes("this day")) {
      return `Today you've made ${fmtMoney(revenueToday, this.symbol)} across ${salesToday.length} sale${salesToday.length !== 1 ? "s" : ""}.`;
    }

    const allRevenue = transactions.filter((t) => t.status === "completed").reduce((s, t) => s + t.total, 0);
    return `Total revenue: ${fmtMoney(allRevenue, this.symbol)} (${transactions.filter((t) => t.status === "completed").length} completed sales). Today: ${fmtMoney(revenueToday, this.symbol)}.`;
  }

  private topProductsAnswer(): string {
    const { products, transactions } = this.db;
    const soldMap = new Map<string, { name: string; qty: number; revenue: number }>();

    for (const t of transactions) {
      if (t.status !== "completed") continue;
      for (const item of t.items) {
        const cur = soldMap.get(item.productId) ?? { name: item.name, qty: 0, revenue: 0 };
        cur.qty += item.qty;
        cur.revenue += item.price * item.qty - item.lineDiscount;
        soldMap.set(item.productId, cur);
      }
    }

    const ranked = Array.from(soldMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);
    if (ranked.length === 0) return "No sales data yet.";

    const lines = ranked.map((p, i) => `${i + 1}. ${p.name} — ${p.qty} sold, ${fmtMoney(p.revenue, this.symbol)}`).join("\n");
    return `Top selling products:\n${lines}`;
  }

  private stockAnswer(q: string): string {
    const { products } = this.db;
    const active = products.filter((p) => p.status === "active");
    const low = active.filter((p) => p.stock > 0 && p.stock <= p.lowStockThreshold);
    const out = active.filter((p) => p.stock <= 0);

    let msg = "";
    if (out.length > 0) {
      msg += `Out of stock: ${out.map((p) => p.name).join(", ")}\n`;
    }
    if (low.length > 0) {
      msg += `Low stock: ${low.map((p) => `${p.name} (${p.stock} left)`).join(", ")}\n`;
    }
    if (!msg) msg = "All products are stocked up. ";
    msg += `${active.length} active products tracked.`;
    return msg.trim();
  }

  private productAnswer(name: string): string {
    const { products } = this.db;
    const p = products.find((x) => x.name.toLowerCase().includes(name.toLowerCase()));
    if (!p) return `I couldn't find a product matching "${name}".`;

    const txns = this.db.transactions.filter((t) => t.status === "completed");
    const sold = txns.reduce((n, t) => n + t.items.filter((i) => i.productId === p.id).reduce((m, i) => m + i.qty, 0), 0);
    const revenue = txns.reduce((s, t) => s + t.items.filter((i) => i.productId === p.id).reduce((m, i) => m + i.price * i.qty - i.lineDiscount, 0), 0);

    return `${p.name}\nPrice: ${fmtMoney(p.price, this.symbol)} | Stock: ${p.stock} | Status: ${p.status}\nSold: ${sold} | Revenue: ${fmtMoney(revenue, this.symbol)}`;
  }

  private findProductMention(q: string): string | null {
    const { products } = this.db;
    // Check if any product name (or first word) appears in the question
    const words = q.split(/\s+/);
    for (const p of products.filter((x) => x.status === "active")) {
      const nameLower = p.name.toLowerCase();
      if (q.includes(nameLower)) return p.name;
      const firstWord = nameLower.split(" ")[0];
      if (firstWord.length > 2 && q.includes(firstWord)) return p.name;
    }
    return null;
  }

  private customersAnswer(q: string): string {
    const { customers, transactions } = this.db;
    const total = customers.length;
    const withPurchases = customers.filter((c) => c.purchases > 0).length;
    const topCustomer = customers
      .filter((c) => c.totalSpent > 0)
      .sort((a, b) => b.totalSpent - a.totalSpent)[0];

    let msg = `${total} customer${total !== 1 ? "s" : ""} total, ${withPurchases} have made purchases.`;
    if (topCustomer) {
      msg += `\nTop customer: ${topCustomer.name} — ${fmtMoney(topCustomer.totalSpent, this.symbol)} spent.`;
    }
    return msg;
  }

  private transactionsAnswer(q: string): string {
    const { transactions } = this.db;
    const completed = transactions.filter((t) => t.status === "completed");
    const today = this.today;
    const todayCount = completed.filter((t) => dayKey(t.date) === today).length;
    return `${completed.length} completed sales total, ${todayCount} today.`;
  }
}
