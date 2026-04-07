import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { applyShopifyPartnerEnv } from "./apply-shopify-partner-env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
applyShopifyPartnerEnv(root);

const command = process.argv.slice(2).join(" ").trim();
if (!command) {
  console.error("Usage: node ./scripts/run-with-shopify-env.mjs <shell command>");
  process.exit(1);
}

const result = spawnSync(command, {
  cwd: root,
  env: process.env,
  shell: true,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
