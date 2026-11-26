import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = JSON.parse(execFileSync("terraform", ["output", "-json"], { cwd: root, encoding: "utf8" }));
const required = (name) => {
  const value = output[name]?.value;
  if (typeof value !== "string" || value.length === 0) throw new Error(`Terraform output ${name} is missing.`);
  return value;
};
const configPath = resolve(root, ".generated/wrangler.private.jsonc");
const config = {
  name: required("worker_name"), account_id: required("account_id"), main: "../worker/index.ts", compatibility_date: "2026-11-25", workers_dev: true, preview_urls: false,
  assets: { directory: "assets", binding: "ASSETS", run_worker_first: true },
  vars: { PRIVATE_HOSTNAME: required("private_hostname"), ACCESS_AUDIENCE: required("access_audience"), ACCESS_TEAM_DOMAIN: required("access_team_domain"), ACCESS_OWNER_EMAIL: required("owner_email") },
};
mkdirSync(dirname(configPath), { recursive: true, mode: 0o700 });
writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
console.log("Wrote ignored private Wrangler configuration. Review it locally, then deploy.");
