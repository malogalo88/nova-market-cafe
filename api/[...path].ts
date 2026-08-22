/**
 * Vercel serverless entrypoint -- production backend for NovaPOS.
 *
 * Every /api/* request on the deployed site lands here and is handled by the
 * exact same router as the local server (server/core.ts). Data persists in
 * Postgres (set POSTGRES_URL / DATABASE_URL, e.g. Vercel Postgres / Neon),
 * which is what keeps QR ordering alive when no laptop is running.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleApiRequest, json } from "../server/core";
import { chooseStore } from "../server/store";

export const config = {
  api: {
    // We parse the body ourselves (readBody) so we can stream it and enforce
    // our own size limit.
    bodyParser: false,
  },
};

// One store per lambda instance; connections are cached on globalThis inside
// PgStore so warm invocations reuse them.
const store = chooseStore();

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const host = req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/api", `http://${host}`);
  try {
    await handleApiRequest(req, res, url, store);
  } catch (err) {
    console.error("[api]", (err as Error).message);
    if (!res.headersSent) {
      json(res, (err as Error).message === "Invalid JSON" || (err as Error).message === "Payload too large" ? 400 : 500, {
        ok: false,
        error: (err as Error).message,
      });
    }
  }
}
