/**
 * Plain-named wrapper for GET/POST /api/chat/messages -- chat history, incremental polls and sends.
 * Exists so multi-segment API routes work even when the bracketed catch-all
 * file ([...path].ts) is lost or renamed by a deployment pipeline, and so no
 * deployment can leave /api/chat/* without an attached serverless function.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { serveApi } from "../../server/core.js";

export const config = { api: { bodyParser: false } };

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  await serveApi(req, res);
}
