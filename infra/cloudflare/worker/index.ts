import { accessConfigFromEnv, verifyAccessJwt } from "./auth.ts";
interface Env { ASSETS: { fetch(request: Request): Promise<Response> }; PRIVATE_HOSTNAME: string; ACCESS_AUDIENCE: string; ACCESS_TEAM_DOMAIN: string; ACCESS_OWNER_EMAIL: string; }
const privateHeaders = { "Cache-Control": "no-store" };
const unavailable = () => new Response("Private deployment is not configured.", { status: 503, headers: privateHeaders });
const forbidden = () => new Response("Forbidden", { status: 403, headers: privateHeaders });
export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const config = accessConfigFromEnv(env);
  if (!config || !env.PRIVATE_HOSTNAME) return unavailable();
  if (new URL(request.url).hostname !== env.PRIVATE_HOSTNAME) return forbidden();
  if (!(await verifyAccessJwt(request.headers.get("Cf-Access-Jwt-Assertion"), config))) return forbidden();
  const asset = await env.ASSETS.fetch(request);
  const headers = new Headers(asset.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
}
export default { fetch: handleRequest };
