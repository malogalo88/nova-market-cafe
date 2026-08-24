import { WebSocketServer, WebSocket } from "ws";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Reader, Writer, MSG_C_JOIN, MSG_S_WELCOME, MSG_S_KICK, MSG_C_INPUT, MSG_C_ACTION, MSG_C_PING, MSG_S_PONG, MSG_S_PING, MSG_C_PONG, MSG_C_CHAT, MSG_S_CHAT, MSG_C_LEAVE } from "../../shared/src/protocol.js";
import { sanitizeChat, sanitizeName, RateLimiter, MSG_RATE, INPUT_RATE } from "./anticheat.js";
import { Match } from "./Match.js";
import { ServerEntity } from "./Entity.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(__dirname, "../dist");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json",
};

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse): void {
  let urlPath = (req.url || "/").split("?")[0];
  if (urlPath === "/") urlPath = "/index.html";
  const safe = path.normalize(urlPath).replace(/^([/\\])+/, "");
  const full = path.join(CLIENT_DIST, safe);
  if (!full.startsWith(CLIENT_DIST)) {
    res.writeHead(403); res.end(); return;
  }
  fs.readFile(full, (err, data) => {
    if (err) {
      res.writeHead(404); res.end("not found"); return;
    }
    const ext = path.extname(full).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  });
}

interface ConnWrap {
  ws: WebSocket;
  ent: ServerEntity | null;
  match: Match | null;
  limiter: RateLimiter;
  inputLimiter: RateLimiter;
}

export function startServer(port: number): void {
  const matches: Match[] = [];

  const server = http.createServer((req, res) => {
    if ((req.url || "").startsWith("/healthz")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, matches: matches.length }));
      return;
    }
    serveStatic(req, res);
  });

  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    const cw: ConnWrap = {
      ws,
      ent: null,
      match: null,
      limiter: new RateLimiter(),
      inputLimiter: new RateLimiter(),
    };

    ws.on("message", (data, isBinary) => {
      if (!isBinary) return;
      try {
        handleMessage(cw, data as Buffer);
      } catch (err) {
        console.error("[IRONVEIL] message handler error:", err);
        try { ws.close(4000, "bad_message"); } catch { /* ignore */ }
      }
    });

    ws.on("close", () => {
      if (cw.ent && cw.match) cw.match.removePlayer(cw.ent);
    });

    ws.on("error", () => { /* handled by close */ });
  });

  setInterval(() => {
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      stepMatch(m);
      if (m.phase === 4 && m.ents.every((e) => !e.connected)) {
        matches.splice(i, 1);
      }
    }
  }, Math.round(1000 / 64));

  setInterval(() => {
    const w2 = new Writer(8);
    w2.reset();
    w2.u8(MSG_S_PING);
    w2.u32(Date.now() & 0xffffffff);
    const buf = w2.finish();
    for (const m of matches) {
      for (const e of m.ents) {
        if (e.conn && e.connected && !e.isBot) {
          (e as any)._pingSentAt = Date.now();
          e.conn.send(buf);
        }
      }
    }
  }, 2000);

  function stepMatch(m: Match): void {
    const steps = 1;
    for (let s = 0; s < steps; s++) {
      m.simulate();
      m.broadcastTick();
    }
  }

  function handleMessage(cw: ConnWrap, data: Buffer): void {
    const now = Date.now();
    if (!cw.limiter.allow(now, MSG_RATE)) return;

    const r = new Reader(data);

    if (cw.match === null) {
      const msgType = r.u8();
      if (msgType !== MSG_C_JOIN) return;
      handleJoin(cw, r);
      return;
    }

    const match = cw.match;
    const ent = cw.ent;
    if (!ent || !ent.connected) return;

    const msgType = r.u8();
    switch (msgType) {
      case MSG_C_INPUT:
        if (cw.inputLimiter.allow(now, INPUT_RATE)) match.handleInput(ent, r, true);
        break;
      case MSG_C_ACTION: {
        const kind = r.u8();
        const arg = r.u8();
        if (!cw.inputLimiter.allow(now, 60)) break;
        match.handleAction(ent, kind, arg);
        break;
      }
      case MSG_C_PING: {
        const t = r.u32();
        const w = new Writer(8);
        w.u8(MSG_S_PONG);
        w.u32(t);
        ent.conn?.send(w.finish());
        break;
      }
      case MSG_C_PONG: {
        const sentAt = (ent as any)._pingSentAt as number | undefined;
        if (sentAt) ent.pingMs = Math.max(0, Date.now() - sentAt);
        break;
      }
      case MSG_C_CHAT: {
        const text = sanitizeChat(r.str());
        if (!cw.inputLimiter.allow(now, 4)) break;
        const w = new Writer(128);
        w.u8(MSG_S_CHAT);
        w.u8(ent.id);
        w.str(text);
        broadcast(match, w.finish());
        break;
      }
      case MSG_C_LEAVE:
        match.removePlayer(ent);
        cw.match = null;
        cw.ent = null;
        break;
    }
  }

  function handleJoin(cw: ConnWrap, r: Reader): void {
    const name = sanitizeName(r.str());
    const token = r.str();
    const modeReq = r.u8();
    const loadout = r.u8();
    const agent = r.u8();
    const mode = modeReq === 0 || modeReq === 1 ? modeReq : 0;

    let match: Match | undefined = matches.find((m) => m.mode === mode && !m.ended && m.ents.filter((e) => e.connected).length < 12);
    if (!match) {
      match = new Match({
        mode,
        botFill: 9,
        botDifficulty: 1,
        onBroadcast: (d) => broadcast(match!, d),
        onSendTo: (id, d) => sendTo(match!, id, d),
        onEnded: () => { /* matches cleaned when empty */ },
      });
      matches.push(match);
    }

    let joined;
    try {
      joined = match.addPlayer(name, token, cw.ws);
    } catch (err) {
      const w = new Writer(64);
      w.u8(MSG_S_KICK);
      w.str("Match full");
      cw.ws.send(w.finish());
      cw.ws.close();
      return;
    }

    joined.ent.loadoutPrimary = loadout >= 1 && loadout <= 5 ? loadout : 2;
    if (agent >= 0 && agent < 4) joined.ent.agent = agent;

    cw.match = match;
    cw.ent = joined.ent;

    const w = new Writer(128);
    w.u8(MSG_S_WELCOME);
    w.u8(joined.ent.id);
    w.u32(match.tick);
    w.u8(64);
    w.u8(match.mode);
    w.u8(joined.ent.team);
    w.str(match.map.name);
    w.str(joined.newToken);
    cw.ws.send(w.finish());
  }

  function broadcast(m: Match, data: Uint8Array): void {
    for (const e of m.ents) {
      if (e.conn && e.connected && !e.isBot) {
        try { e.conn.send(data); } catch { /* ignore */ }
      }
    }
  }

  function sendTo(m: Match, id: number, data: Uint8Array): void {
    const e = m.ents.find((x) => x.id === id);
    if (e && e.conn && e.connected) {
      try { e.conn.send(data); } catch { /* ignore */ }
    }
  }

  console.log(`[IRONVEIL] server listening on http://localhost:${port}`);
  console.log(`[IRONVEIL] open http://localhost:${port} in a browser to play`);

  server.listen(port);
}
