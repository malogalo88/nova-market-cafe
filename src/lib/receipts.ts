import type { DB, Transaction } from "./types";
import { fmtDateTime, fmtDateShort, dayKey } from "./format";
import { PAYMENT_LABELS } from "./types";

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface ReceiptData {
  businessName: string;
  address: string;
  phone: string;
  footer: string;
  txn: Transaction;
}

export function buildReceiptHTML(txn: Transaction, db: DB, opts?: { refunded?: boolean }): string {
  const s = db.settings;
  const rows = txn.items
    .map(
      (it) => `
      <tr>
        <td class="qty">${it.qty}</td>
        <td>${esc(it.name)}<span class="sku">${esc(it.sku)}</span></td>
        <td class="num">${money(it.price, s.currencySymbol)}</td>
        <td class="num">${money(it.price * it.qty - it.lineDiscount, s.currencySymbol)}</td>
      </tr>`
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${esc(
    txn.number
  )}</title><style>
    body{font-family:'Courier New',monospace;color:#111;max-width:340px;margin:0 auto;padding:24px 12px;}
    .center{text-align:center}.muted{color:#555}
    h1{font-size:18px;margin:0 0 2px}h1+div{font-size:11px;line-height:1.5}
    hr{border:none;border-top:1px dashed #999;margin:10px 0}
    table{width:100%;border-collapse:collapse;font-size:12px}
    td{padding:3px 0;vertical-align:top}
    .qty{width:26px}.num{text-align:right;white-space:nowrap}
    .sku{display:block;font-size:9px;color:#777}
    .totals td{padding:2px 0;font-size:12px}
    .grand{font-weight:bold;font-size:15px;border-top:1px solid #000;padding-top:5px!important}
    .foot{margin-top:14px;font-size:11px;text-align:center;line-height:1.6}
    @media print{body{padding:4px}}
  </style></head><body>
    <div class="center">
      ${s.logo ? `<img src="${s.logo}" style="height:52px;margin-bottom:6px" alt="logo"/>` : ""}
      <h1>${esc(s.businessName)}</h1>
      <div class="muted">${esc(s.address)}<br/>${esc(s.phone)}</div>
    </div>
    <hr/>
    <table>
      <tr><td>Receipt #:</td><td class="num">${esc(txn.number)}</td></tr>
      <tr><td>Date:</td><td class="num">${esc(fmtDateTime(txn.date))}</td></tr>
      <tr><td>Cashier:</td><td class="num">${esc(txn.employeeName)}</td></tr>
      ${
        txn.customerName
          ? `<tr><td>Customer:</td><td class="num">${esc(txn.customerName)}</td></tr>`
          : ""
      }
      ${opts?.refunded ? `<tr><td><b>STATUS:</b></td><td class="num"><b>REFUNDED</b></td></tr>` : ""}
    </table>
    <hr/>
    <table>
      <tr><th class="qty"></th><th></th><th class="num muted">Price</th><th class="num muted">Total</th></tr>
      ${rows}
    </table>
    <hr/>
    <table class="totals">
      <tr><td>Subtotal</td><td class="num">${money(txn.subtotal, s.currencySymbol)}</td></tr>
      ${txn.discount > 0 ? `<tr><td>Discount${txn.promoNames.length ? ` (${esc(txn.promoNames.join(", "))})` : ""}</td><td class="num">-${money(txn.discount, s.currencySymbol)}</td></tr>` : ""}
      ${txn.pointsRedeemed > 0 ? `<tr><td>Loyalty points (${txn.pointsRedeemed})</td><td class="num">included in discount</td></tr>` : ""}
      <tr><td>Tax (${(s.taxEnabled ? s.taxRate : 0).toFixed(1)}%)</td><td class="num">${money(txn.tax, s.currencySymbol)}</td></tr>
      <tr><td class="grand">TOTAL</td><td class="num grand">${money(txn.total, s.currencySymbol)}</td></tr>
      <tr><td>Paid (${PAYMENT_LABELS[txn.paymentMethod]})</td><td class="num">${money(txn.amountPaid, s.currencySymbol)}</td></tr>
      ${txn.change !== 0 ? `<tr><td>Change</td><td class="num">${money(txn.change, s.currencySymbol)}</td></tr>` : ""}
    </table>
    <div class="foot">
      ${txn.note ? `<div>Note: ${esc(txn.note)}</div><br/>` : ""}
      ${esc(s.receiptFooter)}<br/>
      ${pointsLine(txn)}
    </div>
  </body></html>`;
}

function pointsLine(t: Transaction): string {
  if (t.pointsEarned <= 0) return "";
  return `<span>You earned ${t.pointsEarned} loyalty points</span>`;
}

function money(n: number, symbol: string): string {
  const neg = n < 0 ? "-" : "";
  return `${neg}${symbol}${Math.abs(n).toFixed(2)}`;
}

export function printReceipt(txn: Transaction, db: DB, opts?: { refunded?: boolean }): void {
  const w = window.open("", "_blank", "width=420,height=640");
  if (!w) return;
  w.document.write(buildReceiptHTML(txn, db, opts));
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
  }, 250);
}

export function downloadReceipt(txn: Transaction, db: DB, opts?: { refunded?: boolean }): void {
  const blob = new Blob([buildReceiptHTML(txn, db, opts)], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${txn.number}-receipt.html`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Print product label sheets (name, price + barcode) for shelf edges. */
export function printBarcodes(db: DB, productIds: string[]): void {
  const products = db.products.filter((p) => productIds.includes(p.id));
  const labels = products
    .filter((p) => p.barcode || p.sku)
    .map(
      (p) => `
      <div class="label">
        <div class="pname">${esc(p.name)}</div>
        <svg class="bc" data-code="${esc(p.barcode || p.sku)}"></svg>
        <div class="code">${esc(p.barcode || p.sku)}</div>
        <div class="price">${db.settings.currencySymbol}${p.price.toFixed(2)}</div>
      </div>`
    )
    .join("");
  const w = window.open("", "_blank", "width=760,height=600");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>Barcode Labels</title><style>
    body{font-family:Arial,sans-serif;margin:16px}
    .label{border:1px solid #ccc;border-radius:6px;padding:8px;width:200px;display:inline-block;text-align:center;margin:6px;page-break-inside:avoid}
    .pname{font-size:13px;font-weight:600;height:32px;overflow:hidden}
    .code{font-family:'Courier New',monospace;font-size:10px}
    .price{font-size:20px;font-weight:800;margin-top:4px}
    @media print{.label{border-color:#ddd}}
  </style></head><body>${labels}<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
  <script>JsBarcode(".bc",{format:"CODE128",height:42,width:1.6,fontSize:0,margin:2}).init()<\/script></body></html>`);
  w.document.close();
}

// Small re-exports used by pages.
export { fmtDateShort, dayKey };
