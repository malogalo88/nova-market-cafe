import type { DB } from "./types";
import { fmtMoney, fmtDateTime, dayKey } from "./format";

export interface AIAssistantContext {
  db: DB;
  symbol: string;
  today: string;
}

/** Conversational store assistant. Rule-based (no API key) but built to
 *  understand natural phrasing — not just exact keywords. */
export class StoreAssistant {
  private db: DB;
  private symbol: string;
  private today: string;

  constructor({ db, symbol, today }: AIAssistantContext) {
    this.db = db;
    this.symbol = symbol;
    this.today = today;
  }

  /** Main entry point. Understands natural phrasing like "how much did I make today?" */
  answer(question: string): string {
    const raw = question.trim();
    if (!raw) return "Ask me anything about your store!";

    const q = raw.toLowerCase();

    // Greetings first — keep separate from help
    if (this.isGreeting(q)) return this.greetingAnswer();
    if (this.isHelp(q)) return this.helpAnswer();

    // Timeframe
    const timeframe = this.extractTimeframe(q);

    // Detect intent(s) with word scoring
    const intents = this.detectIntents(q);

    // Check for a specific product mention — prioritize it, even if "stock" is in the question
    const product = this.findProductMention(q);
    if (product) return this.productAnswer(product);

    // If multiple intents, answer each
    if (intents.length > 1) {
      return intents.map((i) => this.answerIntent(i, q, timeframe)).join("\n\n");
    }

    if (intents.length === 1) {
      return this.answerIntent(intents[0], q, timeframe);
    }

    // Fallback: helpful suggestions based on detected words
    return this.fallbackAnswer(q);
  }

  /* ─── Intent detection with word scoring ─── */

  private detectIntents(q: string): string[] {
    const scores: Record<string, number> = {
      revenue: 0,
      sales: 0,
      top: 0,
      lowstock: 0,
      customer: 0,
    };

    // Revenue signals
    const revenueWords = ["revenue", "money", "made", "earn", "earning", "profit", "income", "sales total", "how much", "totals"];
    for (const w of revenueWords) if (q.includes(w)) scores.revenue += 1;

    // Sales/count signals
    const salesWords = ["sale", "sold", "transaction", "order", "orders", "how many", "count", "customers served"];
    for (const w of salesWords) if (q.includes(w)) scores.sales += 1;

    // Top/best signals
    const topWords = ["best", "top", "popular", "best-selling", "bestseller", "rank"];
    for (const w of topWords) if (q.includes(w)) scores.top += 1;

    // Stock signals
    const stockWords = ["stock", "inventory", "low", "out of", "restock", "supply", "shelf"];
    for (const w of stockWords) if (q.includes(w)) scores.lowstock += 1;

    // Customer signals
    const customerWords = ["customer", "client", "regular", "buyer", "people"];
    for (const w of customerWords) if (q.includes(w)) scores.customer += 1;

    // Collect intents that scored above threshold
    const intents: string[] = [];
    const threshold = 1;
    for (const [key, score] of Object.entries(scores)) {
      if (score >= threshold) intents.push(key);
    }

    // Prioritize: if "revenue" and "sales" both match, revenue is more specific
    if (intents.includes("revenue") && intents.includes("sales")) {
      // Keep both if question asks about both money and count
    }

    // Disambiguate: "stock" alone usually means low-stock inventory, not product lookup
    if (intents.includes("lowstock") && intents.includes("top")) {
      // "top product" vs "low stock" - keep both, user might want both
    }

    return intents;
  }

  private answerIntent(intent: string, q: string, timeframe: string): string {
    switch (intent) {
      case "revenue": return this.revenueAnswer(timeframe);
      case "sales": return this.salesAnswer(timeframe);
      case "top": return this.topProductsAnswer();
      case "lowstock": return this.stockAnswer();
      case "customer": return this.customersAnswer();
      default: return this.helpAnswer();
    }
  }

  /* ─── Helpers ─── */

  private isGreeting(q: string): boolean {
    return /^(hi|hello|hey|yo|sup|good morning|good afternoon|good evening|howdy|hiya|greetings)\b/.test(q);
  }

  private isHelp(q: string): boolean {
    return /\bhelp\b/.test(q) || /\bwhat can you (do|answer)\b/.test(q) || q === "hi" || q === "hello";
  }

  private extractTimeframe(q: string): "today" | "week" | "month" | "all" {
    if (/\btoday\b/.test(q)) return "today";
    if (/\bthis week\b/.test(q) || /\bpast week\b/.test(q) || /\blast 7 days\b/.test(q) || /\bweek\b/.test(q)) return "week";
    if (/\bthis month\b/.test(q) || /\bpast month\b/.test(q) || /\blast 30 days\b/.test(q) || /\bmonth\b/.test(q)) return "month";
    return "all";
  }

  private dayKeyFor(date: string): string {
    return dayKey(date);
  }

  private inRange(date: string, tf: string): boolean {
    const d = this.dayKeyFor(date);
    const today = this.today;
    if (tf === "today") return d === today;
    if (tf === "week") {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return d >= dayKey(start.toISOString()) && d <= today;
    }
    if (tf === "month") {
      const start = new Date(today);
      start.setMonth(start.getMonth() - 1);
      return d >= dayKey(start.toISOString()) && d <= today;
    }
    return true;
  }

  /* ─── Answers ─── */

  private greetingAnswer(): string {
    const greetings = [
      "Hey there! I'm your store assistant. Ask me anything about your sales, stock, products, or customers.",
      "Hi! What would you like to know about your store today?",
      "Hello! I can help with revenue, stock levels, best sellers, and more. What's on your mind?",
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  private helpAnswer(): string {
    return `I can answer questions about your store — just ask naturally. Try:

• "How much did I make today?"
• "What's my best selling product?"
• "Which items are low on stock?"
• "Tell me about Espresso Beans"
• "How many customers do I have?"
• "What were my sales this week?"

No special phrasing needed!`;

  }

  private revenueAnswer(tf: string): string {
    const { transactions } = this.db;
    const completed = transactions.filter((t) => t.status === "completed" && this.inRange(t.date, tf));
    const revenue = completed.reduce((s, t) => s + t.total, 0);
    const count = completed.length;

    const label = tf === "today" ? "Today" : tf === "week" ? "This week" : tf === "month" ? "This month" : "All time";

    if (count === 0) {
      return `${label}: no completed sales yet.`;
    }

    return `${label} you've made ${fmtMoney(revenue, this.symbol)} across ${count} sale${count !== 1 ? "s" : ""}.`;
  }

  private salesAnswer(tf: string): string {
    const { transactions } = this.db;
    const completed = transactions.filter((t) => t.status === "completed" && this.inRange(t.date, tf));
    const revenue = completed.reduce((s, t) => s + t.total, 0);
    const count = completed.length;
    const items = completed.reduce((n, t) => n + t.items.reduce((m, i) => m + i.qty, 0), 0);

    const label = tf === "today" ? "Today" : tf === "week" ? "This week" : tf === "month" ? "This month" : "All time";

    return `${label}: ${count} sale${count !== 1 ? "s" : ""}, ${items} item${items !== 1 ? "s" : ""}, ${fmtMoney(revenue, this.symbol)} total.`;
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
    if (ranked.length === 0) return "No sales data yet — complete a few sales and I'll have answers.";

    const lines = ranked.map((p, i) => `${i + 1}. ${p.name} — ${p.qty} sold, ${fmtMoney(p.revenue, this.symbol)}`).join("\n");
    return `🏆 Top selling products:\n${lines}`;
  }

  private stockAnswer(): string {
    const { products } = this.db;
    const active = products.filter((p) => p.status === "active");
    const out = active.filter((p) => p.stock <= 0);
    const low = active.filter((p) => p.stock > 0 && p.stock <= p.lowStockThreshold);
    const ok = active.filter((p) => p.stock > p.lowStockThreshold);

    let msg = "";
    if (out.length > 0) {
      msg += `🔴 Out of stock: ${out.map((p) => p.name).join(", ")}\n`;
    }
    if (low.length > 0) {
      msg += `🟡 Low stock: ${low.map((p) => `${p.name} (${p.stock} left)`).join(", ")}\n`;
    }
    if (ok.length > 0) {
      msg += `✅ Stocked up: ${ok.length} product${ok.length !== 1 ? "s" : ""} fine.`;
    } else if (!out.length && !low.length) {
      msg = "✅ Everything's stocked up — no low-stock or out-of-stock items.";
    }
    return msg.trim();
  }

  private productAnswer(name: string): string {
    const { products, transactions } = this.db;
    const p = products.find((x) => x.name.toLowerCase().includes(name.toLowerCase()));
    if (!p) return `I couldn't find a product matching "${name}". Want to try a different name?`;

    const txns = transactions.filter((t) => t.status === "completed");
    const sold = txns.reduce((n, t) => n + t.items.filter((i) => i.productId === p.id).reduce((m, i) => m + i.qty, 0), 0);
    const revenue = txns.reduce((s, t) => s + t.items.filter((i) => i.productId === p.id).reduce((m, i) => m + i.price * i.qty - i.lineDiscount, 0), 0);
    const lastSale = txns
      .filter((t) => t.items.some((i) => i.productId === p.id))
      .sort((a, b) => b.date.localeCompare(a.date))[0];

    let msg = `${p.name}\n`;
    msg += `Price: ${fmtMoney(p.price, this.symbol)} | Stock: ${p.stock} | Status: ${p.status}\n`;
    msg += `Total sold: ${sold} | Revenue: ${fmtMoney(revenue, this.symbol)}`;
    if (lastSale) {
      msg += `\nLast sold: ${fmtDateTime(lastSale.date)}`;
    }
    return msg;
  }

  private findProductMention(q: string): string | null {
    const { products } = this.db;
    const active = products.filter((x) => x.status === "active");
    if (active.length === 0) return null;

    // Remove common question words so they don't false-match
    const noise = ["the", "a", "an", "about", "tell", "me", "what", "is", "are", "how", "much", "many", "did", "do", "i", "my", "today", "week", "month", "sales", "revenue", "stock", "inventory", "can", "you", "tell", "me", "about"];
    const tokens = q.split(/\s+/).filter((w) => w.length > 2 && !noise.includes(w));

    // Score each product by how many of its words appear in the question
    let best: { name: string; score: number } | null = null;

    for (const p of active) {
      const pWords = p.name.toLowerCase().split(/\s+/);
      let score = 0;
      for (const pw of pWords) {
        if (tokens.some((t) => t === pw || t.includes(pw) || pw.includes(t))) score += 1;
      }
      // Bonus for exact full-name match
      if (q.includes(p.name.toLowerCase())) score += 5;

      if (score > 0 && (!best || score > best.score)) {
        best = { name: p.name, score };
      }
    }

    return best ? best.name : null;
  }

  private customersAnswer(): string {
    const { customers, transactions } = this.db;
    const total = customers.length;
    const withPurchases = customers.filter((c) => c.purchases > 0).length;
    const topCustomer = customers
      .filter((c) => c.totalSpent > 0)
      .sort((a, b) => b.totalSpent - a.totalSpent)[0];
    const newThisMonth = customers.filter((c) => this.inRange(c.createdAt, "month")).length;

    let msg = `${total} customer${total !== 1 ? "s" : ""} total, ${withPurchases} have made at least one purchase.`;
    if (newThisMonth > 0) msg += ` ${newThisMonth} new this month.`;
    if (topCustomer) {
      msg += `\nTop customer: ${topCustomer.name} — ${fmtMoney(topCustomer.totalSpent, this.symbol)} spent, ${topCustomer.purchases} order${topCustomer.purchases !== 1 ? "s" : ""}.`;
    }
    return msg;
  }

  private fallbackAnswer(q: string): string {
    // Give contextual suggestions based on detected words
    const suggestions: string[] = [];

    if (/\bmoney|revenue|make|earn\b/.test(q)) suggestions.push("Try: \"How much did I make today?\"");
    if (/\bstock|inventory|item|product\b/.test(q)) suggestions.push("Try: \"What's low on stock?\"");
    if (/\bbest|top|popular\b/.test(q)) suggestions.push("Try: \"What's my best selling product?\"");
    if (/\bcustomer|client\b/.test(q)) suggestions.push("Try: \"How many customers do I have?\"");

    const base = "I'm not sure I understood that. I can help with sales, revenue, stock, products, and customers.";
    if (suggestions.length > 0) {
      return `${base}\n\n${suggestions.join("\n")}`;
    }
    return `${base}\n\nTry: "What's my revenue today?" or "Which products are low on stock?"`;
  }
}
