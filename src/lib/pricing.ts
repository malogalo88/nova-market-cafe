import type { CartLine, DB, Promotion } from "./types.js";

/** Pure cart/pricing engine shared by the POS client and the order server,
 *  so a phone order is priced exactly like an in-store one. */

export interface CartCalcLine extends CartLine {
  product: DB["products"][number];
  unitPrice: number;
  lineDiscount: number;
  matchedPromos: string[];
}

export interface CartTotals {
  calcLines: CartCalcLine[];
  subtotal: number;
  lineDiscounts: number;
  orderDiscount: number;
  orderDiscountLabel: string;
  loyaltyDiscount: number;
  pointsValue: number;
  pointsRedeemed: number;
  tax: number;
  total: number;
  error?: string;
}

export function isPromoActive(p: Promotion, now = new Date()): boolean {
  if (!p.active) return false;
  const today = dayKeyOf(now);
  if (p.startDate && today < p.startDate) return false;
  if (p.endDate && today > p.endDate) return false;
  return true;
}

function dayKeyOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function emptyCalc(
  calcLines: CartCalcLine[],
  grossSubtotal: number,
  lineDiscounts: number,
  error: string
): CartTotals {
  return {
    calcLines,
    subtotal: Math.round(grossSubtotal * 100) / 100,
    lineDiscounts: Math.round(lineDiscounts * 100) / 100,
    orderDiscount: 0,
    orderDiscountLabel: "",
    loyaltyDiscount: 0,
    pointsValue: 0,
    pointsRedeemed: 0,
    tax: 0,
    total: 0,
    error,
  };
}

/** Full price calculation shared between POS live totals and final sale.
 *  `maxDiscountPercent` caps manual discounts (client passes the logged-in
 *  user's permission; the server never accepts manual discounts anyway). */
export function computeCart(
  db: DB,
  lines: CartLine[],
  opts: {
    customerId: string | null;
    couponCode?: string;
    manualDiscount?: { type: "percent" | "fixed"; value: number } | null;
    pointsToRedeem?: number;
    maxDiscountPercent?: number;
  }
): CartTotals {
  const s = db.settings;
  const calcLines: CartCalcLine[] = [];
  let lineDiscounts = 0;

  for (const line of lines) {
    const product = db.products.find((p) => p.id === line.productId);
    if (!product) continue;
    let discount = 0;
    const matched: string[] = [];
    for (const promo of db.promotions) {
      if (!isPromoActive(promo)) continue;
      if (!promo.autoApply || promo.code) continue;
      if (promo.type !== "bogo") continue;
      if (promo.scope === "product" && promo.targetId === product.id) {
        const groups = Math.floor(line.qty / Math.max(1, promo.buyQty + promo.getQty));
        const free = groups * promo.getQty;
        if (free > 0) {
          discount += free * product.price;
          matched.push(promo.name);
        }
      }
      void promo.value;
    }
    for (const promo of db.promotions) {
      if (!isPromoActive(promo)) continue;
      if (!promo.autoApply || promo.code) continue;
      if (promo.type === "bogo") continue;
      const scopeMatch =
        promo.scope === "category"
          ? product.category === promo.targetId
          : false;
      const productMatch = promo.scope === "product" ? product.id === promo.targetId : false;
      if (!scopeMatch && !productMatch) continue;
      const base = product.price * line.qty;
      const d = promo.type === "percent" ? (base * promo.value) / 100 : Math.min(promo.value, base);
      if (d > 0) {
        discount += d;
        matched.push(promo.name);
      }
    }
    lineDiscounts += discount;
    calcLines.push({
      ...line,
      product,
      unitPrice: product.price,
      lineDiscount: Math.round(discount * 100) / 100,
      matchedPromos: matched,
    });
  }

  const grossSubtotal = calcLines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
  const subtotal = grossSubtotal - lineDiscounts;

  // Order-level discount: manual beats coupon beats automatic.
  let orderDiscount = 0;
  let orderDiscountLabel = "";
  const maxManual = opts.maxDiscountPercent ?? 100;
  if (opts.manualDiscount && opts.manualDiscount.value > 0) {
    const md = opts.manualDiscount;
    if (md.type === "percent" && md.value > maxManual) {
      return {
        ...emptyCalc(calcLines, grossSubtotal, lineDiscounts, `This role allows manual discounts up to ${maxManual}%.`),
      };
    }
    orderDiscount =
      md.type === "percent"
        ? (subtotal * Math.min(md.value, 100)) / 100
        : Math.min(md.value, subtotal);
    orderDiscountLabel = md.type === "percent" ? `${md.value}% off` : "Manual discount";
  } else if (opts.couponCode && opts.couponCode.trim()) {
    const promo = db.promotions.find(
      (p) => p.code && p.code.toLowerCase() === opts.couponCode!.trim().toLowerCase()
    );
    if (!promo) {
      return emptyCalc(calcLines, grossSubtotal, lineDiscounts, "That coupon code doesn't exist.");
    }
    if (!isPromoActive(promo)) {
      return emptyCalc(calcLines, grossSubtotal, lineDiscounts, "That coupon isn't active right now.");
    }
    if (subtotal < promo.minOrder) {
      return emptyCalc(
        calcLines,
        grossSubtotal,
        lineDiscounts,
        `This coupon needs a minimum order of ${s.currencySymbol}${promo.minOrder.toFixed(2)}.`
      );
    }
    orderDiscount =
      promo.type === "percent"
        ? (subtotal * promo.value) / 100
        : Math.min(promo.value, subtotal);
    orderDiscountLabel = promo.name;
  } else {
    const autos = db.promotions.filter(
      (p) =>
        isPromoActive(p) &&
        p.autoApply &&
        !p.code &&
        p.scope === "order" &&
        subtotal >= p.minOrder
    );
    let best = 0;
    let bestName = "";
    for (const p of autos) {
      const d = p.type === "percent" ? (subtotal * p.value) / 100 : Math.min(p.value, subtotal);
      if (d > best) {
        best = d;
        bestName = p.name;
      }
    }
    if (best > 0) {
      orderDiscount = best;
      orderDiscountLabel = bestName;
    }
  }

  // Loyalty level perk.
  const customer = opts.customerId ? db.customers.find((c) => c.id === opts.customerId) : null;
  let loyaltyDiscount = 0;
  if (customer && s.loyalty.enabled) {
    const level = [...s.loyalty.levels]
      .sort((a, b) => b.threshold - a.threshold)
      .find((l) => customer.totalSpent >= l.threshold);
    if (level && level.perkPercent > 0) {
      const baseAfter = Math.max(0, subtotal - orderDiscount);
      loyaltyDiscount = (baseAfter * level.perkPercent) / 100;
    }
  }

  // Points redemption.
  let pointsRedeemed = 0;
  let pointsValue = 0;
  if (customer && s.loyalty.enabled && opts.pointsToRedeem && opts.pointsToRedeem > 0) {
    const maxByBalance = Math.min(opts.pointsToRedeem, customer.loyaltyPoints);
    pointsValue = maxByBalance / s.loyalty.pointsPerUnit;
    const remainingTotal = Math.max(0, subtotal - orderDiscount - loyaltyDiscount);
    if (pointsValue > remainingTotal) {
      pointsValue = remainingTotal;
      pointsRedeemed = Math.floor(remainingTotal * s.loyalty.pointsPerUnit);
    } else {
      pointsRedeemed = Math.floor(maxByBalance);
    }
  }

  const discountedTotal = Math.max(0, subtotal - orderDiscount - loyaltyDiscount - pointsValue);
  const tax = s.taxEnabled ? (discountedTotal * s.taxRate) / 100 : 0;
  const total = Math.round((discountedTotal + tax) * 100) / 100;

  return {
    calcLines,
    subtotal: Math.round(grossSubtotal * 100) / 100,
    lineDiscounts: Math.round(lineDiscounts * 100) / 100,
    orderDiscount: Math.round(orderDiscount * 100) / 100,
    orderDiscountLabel,
    loyaltyDiscount: Math.round(loyaltyDiscount * 100) / 100,
    pointsValue: Math.round(pointsValue * 100) / 100,
    pointsRedeemed,
    tax: Math.round(tax * 100) / 100,
    total,
  };
}
