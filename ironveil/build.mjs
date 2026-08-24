import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const r = (p) => join(root, p);

rmSync(r("dist"), { recursive: true, force: true });
rmSync(r("dist-server"), { recursive: true, force: true });
mkdirSync(r("dist"), { recursive: true });
mkdirSync(r("dist-server"), { recursive: true });

await build({
  entryPoints: [r("client/src/main.ts")],
  bundle: true,
  format: "iife",
  target: "es2020",
  outfile: r("dist/app.js"),
  sourcemap: false,
  minify: true,
  legalComments: "none",
  logLevel: "warning",
});

await build({
  entryPoints: [
    { in: r("server/src/index.ts"), out: "index" },
    { in: r("tests/unit.ts"), out: "unit" },
    { in: r("tools/smoke.ts"), out: "smoke" },
  ],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outdir: r("dist-server"),
  sourcemap: false,
  minify: false,
  external: ["ws"],
  logLevel: "warning",
});

cpSync(r("client/src/index.html"), r("dist/index.html"));
cpSync(r("client/src/style.css"), r("dist/style.css"));
console.log("build ok");
