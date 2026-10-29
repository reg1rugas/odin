import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
const root = process.cwd();
const manifest = JSON.parse(
  await fs.readFile(path.join(root, ".openai/hosting.json"), "utf8"),
);
if (!manifest.d1) throw new Error("No D1 binding is configured.");
const runtime = path.join(root, ".sites-runtime");
await fs.mkdir(runtime, { recursive: true });
const config = path.join(runtime, "local-migrations.json");
await fs.writeFile(
  config,
  JSON.stringify({
    name: "odin-local-migrations",
    compatibility_date: "2026-05-15",
    d1_databases: [
      {
        binding: manifest.d1,
        database_name: "site-creator-d1",
        database_id: "00000000-0000-4000-8000-000000000000",
        migrations_dir: path.join(root, "drizzle"),
      },
    ],
  }),
);
const state = process.argv[2] || ".wrangler/state";
const result = spawnSync(
  process.execPath,
  [
    "--import",
    "./scripts/sites-env.mjs",
    "./node_modules/wrangler/bin/wrangler.js",
    "d1",
    "migrations",
    "apply",
    manifest.d1,
    "--local",
    "--config",
    config,
    "--persist-to",
    state,
  ],
  { cwd: root, stdio: "inherit" },
);
process.exit(result.status ?? 1);
