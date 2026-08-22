const KEY = "novapos.qrsession";

/** Anonymous per-browser identifier so customers can track/cancel their own orders. */
export function getQrSessionId(): string {
  try {
    let id = sessionStorage.getItem(KEY);
    if (!id) {
      id = `ses_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      sessionStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "ses_fallback";
  }
}
