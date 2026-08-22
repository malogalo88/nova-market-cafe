import QRCode from "qrcode";
import type { DB, QrCode } from "./types";
import { esc } from "./receipts";

/** Where the app is (or will be) served — used when baking URLs into printed
 *  QR codes. The optional publicBaseUrl lets the owner set their real
 *  production address so posters survive redeploys, dev-server port changes,
 *  and printing from a staging machine. */
export function qrBase(db?: DB): string {
  const configured = db?.settings.qr.publicBaseUrl?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  return `${window.location.origin}${window.location.pathname}`;
}

/** The URL a customer's phone opens when scanning this code. */
export function qrUrl(code: QrCode, db?: DB): string {
  return `${qrBase(db)}#/order/${code.id}`;
}

export async function qrDataUrl(code: QrCode, size = 512, db?: DB): Promise<string> {
  return QRCode.toDataURL(qrUrl(code, db), {
    width: size,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#111827", light: "#ffffff" },
  });
}

export function downloadQrPng(code: QrCode, dataUrl: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `qr-${code.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
  a.click();
}

/** Opens a printable poster: business name, SCAN TO ORDER, code, location, instructions. */
export function printQrPoster(db: DB, code: QrCode, dataUrl: string): void {
  const s = db.settings;
  const win = window.open("", "_blank", "width=640,height=880");
  if (!win) return;
  const onDevHost = /^(localhost|127\.0\.0\.1|\[::1\]|.*\.local)$/i.test(new URL(qrBase(db)).hostname) && !s.qr.publicBaseUrl;
  win.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(code.label)} — Order Here</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; background: #fff; display: flex; justify-content: center; padding: 24px; }
  .poster { width: 480px; border: 4px solid #4f46e5; border-radius: 28px; padding: 40px 32px; text-align: center; }
  .brand { font-size: 22px; font-weight: 800; letter-spacing: .02em; color: #111827; }
  .logo { max-width: 96px; max-height: 96px; margin: 0 auto 14px; display: block; border-radius: 18px; }
  h1 { font-size: 44px; line-height: 1.05; margin: 18px 0 6px; color: #4f46e5; letter-spacing: -.01em; }
  .sub { font-size: 17px; color: #374151; margin-bottom: 26px; }
  img.qr { width: 340px; height: 340px; }
  .loc { display: inline-block; margin-top: 24px; font-size: 26px; font-weight: 800; color: #fff; background: #4f46e5; padding: 10px 28px; border-radius: 999px; }
  .how { margin-top: 22px; font-size: 15.5px; line-height: 1.5; color: #4b5563; }
  .foot { margin-top: 26px; padding-top: 16px; border-top: 2px solid #e5e7eb; font-size: 13px; color: #6b7280; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="poster">
    ${s.logo ? `<img class="logo" src="${s.logo}" alt="" />` : ""}
    <div class="brand">${esc(s.businessName)}</div>
    <h1>SCAN TO<br/>ORDER</h1>
    <p class="sub">Point your phone camera at the code</p>
    <img class="qr" src="${dataUrl}" alt="QR code to order" />
    <div><span class="loc">${esc(code.label)}</span></div>
    <p class="how">${esc(s.qr.instructions || "Browse our products and place your order from your phone.")}</p>
    ${onDevHost ? `<p class="how" style="color:#b45309">⚠ Printed from a development address — set your website address in Settings → QR Ordering before printing for customers.</p>` : ""}
    <div class="foot">${[s.address, s.phone].filter(Boolean).map(esc).join(" · ")}</div>
  </div>
  <script>window.onload = function () { window.focus(); window.print(); };</script>
</body>
</html>`);
  win.document.close();
}
