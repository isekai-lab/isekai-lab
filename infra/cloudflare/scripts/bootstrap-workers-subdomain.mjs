import { fileURLToPath } from "node:url";
import process from "node:process";

export async function ensureWorkersSubdomain({ accountId, token, desired, fetchFn = fetch }) {
  if (!accountId || !token || !desired) throw new Error("Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, and CLOUDFLARE_WORKERS_SUBDOMAIN in the shell.");
  if (!/^[a-z0-9-]+$/.test(desired)) throw new Error("CLOUDFLARE_WORKERS_SUBDOMAIN must contain only lowercase letters, digits, and hyphens.");
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/workers/subdomain`;
  const request = async (method, body) => {
    const response = await fetchFn(endpoint, { method, headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    if (method === "GET" && response.status === 404) return undefined;
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(`Cloudflare API ${method} failed (${response.status}).`);
    return payload.result;
  };
  const current = await request("GET");
  if (current?.subdomain) {
    if (current.subdomain !== desired) throw new Error("An existing workers.dev subdomain differs from CLOUDFLARE_WORKERS_SUBDOMAIN; refusing to change it.");
    return "already-registered";
  }
  await request("PUT", { subdomain: desired });
  return "registered";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await ensureWorkersSubdomain({ accountId: process.env.CLOUDFLARE_ACCOUNT_ID, token: process.env.CLOUDFLARE_API_TOKEN, desired: process.env.CLOUDFLARE_WORKERS_SUBDOMAIN });
  console.log(result === "registered" ? "workers.dev subdomain registered." : "workers.dev subdomain already matches the requested value.");
}
