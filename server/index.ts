/**
 * NovaPOS local server -- one process serving BOTH the built website (dist/)
 * and the JSON API. This is the LAN/offline mode: handy for the counter,
 * but customers do not depend on it (production runs on Vercel + Postgres,
 * see DEPLOY.md).
 *
 *   npm run build     -> produces dist/
 *   npm run server    -> serves dist/ + /api on http://0.0.0.0:8787
 *
 * Set POSTGRES_URL or DATABASE_URL to share data via a real database instead
 * of the local file; otherwise data/db.json is used.
 */
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleApiRequest, json } from "./core";
import { chooseStore } from "./store";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
};

function serveStatic(res: http.ServerResponse, pathname: string): void {
  const rel = pathname === "/" ? "/index.html" : pathname;
  const file = path.normalize(path.join(DIST, rel));
  if (!file.startsWith(DIST)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(file)
    .then((data) => {
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      res.end(data);
    })
    .catch(() => {
      // SPA fallback -- the app uses hash routing so this is mostly for safety.
      fs.readFile(path.join(DIST, "index.html"))
        .then((data) => {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(data);
        })
        .catch(() => {
          res.writeHead(503, { "Content-Type": "text/plain" });
          res.end("NovaPOS server is running but dist/ is missing -- run `npm run build` first.");
        });
    });
}

const store = chooseStore();

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  if (url.pathname.startsWith("/api/")) {
    handleApiRequest(req, res, url, store).catch((err) => {
      console.error("[api]", err.message);
      if (!res.headersSent) {
        json(res, err.message === "Invalid JSON" || err.message === "Payload too large" ? 400 : 500, {
          ok: false,
          error: err.message,
        });
      }
    });
    return;
  }
  serveStatic(res, url.pathname);
});

server.listen(PORT, HOST, async () => {
  try {
    await store.get(); // opens/creates/seeds the database up front
  } catch (err) {
    console.error("[db] initial load failed:", (err as Error).message);
  }
  console.log(`NovaPOS server -> http://${HOST}:${PORT}  (serving dist/ + /api)`);
});
