/**
 * Plain-named wrapper for /api/chat/voice -- staff voice-note upload (POST,
 * raw audio bytes) and download (GET ?id=<mediaId>). Exists so multi-segment
 * API routes work even when the bracketed catch-all file ([...path].ts) is
 * lost or renamed by a deployment pipeline, matching every other chat route.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { serveApi } from "../../server/core.js";

export const config = { api: { bodyParser: false } };

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  await serveApi(req, res);
}
