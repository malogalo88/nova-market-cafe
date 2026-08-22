/**
 * Plain-named wrapper for /api/public/orders --
 *   POST   place a customer order
 *   GET    ?session=<id>  list that session's orders
 *   DELETE ?id=<order>&session=<id>  customer cancels a still-new order
 * Exists so multi-segment API routes work even when the bracketed catch-all
 * file ([...path].ts) is lost or renamed by a deployment pipeline.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { serveApi } from "../../server/core.js";

export const config = { api: { bodyParser: false } };

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  await serveApi(req, res);
}
