/**
 * Plain-named wrapper for POST /api/staff/qr-codes/ensure (sign-in required) --
 * re-guarantees the permanent printed QR ids exist server-side.
 * Exists so multi-segment API routes work even when the bracketed catch-all
 * file ([...path].ts) is lost or renamed by a deployment pipeline.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { serveApi } from "../../../server/core.js";

export const config = { api: { bodyParser: false } };

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  await serveApi(req, res);
}
