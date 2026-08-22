/**
 * Vercel serverless entrypoint -- production backend for NovaPOS.
 *
 * Every /api/* request on the deployed site lands here and is handled by the
 * exact same router as the local server (server/core.ts). Data persists in
 * Postgres (POSTGRES_URL / DATABASE_URL, e.g. Neon), which keeps QR ordering
 * alive when no laptop is running.
 *
 * Plain-named wrappers (api/public/config.ts etc.) exist alongside this file
 * because some pipelines mangle bracket filenames -- see serveApi().
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { serveApi } from "../server/core.js";

export const config = {
  api: {
    // We parse the body ourselves (readBody) so we can stream it and enforce
    // our own size limit.
    bodyParser: false,
  },
};

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  await serveApi(req, res);
}
