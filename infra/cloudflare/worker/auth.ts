import { createRemoteJWKSet, jwtVerify } from "jose";

export interface AccessConfig { audience: string; ownerEmail: string; teamDomain: string; }
export interface AccessEnv {
  ACCESS_AUDIENCE: unknown;
  ACCESS_OWNER_EMAIL: unknown;
  ACCESS_TEAM_DOMAIN: unknown;
}
const jwksByTeam = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwksFor(teamDomain: string) {
  let jwks = jwksByTeam.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    jwksByTeam.set(teamDomain, jwks);
  }
  return jwks;
}

// Test-only hook. Production configuration has a single fixed team domain.
export function resetAccessJwksCacheForTests() { jwksByTeam.clear(); }

export function accessConfigFromEnv(env: AccessEnv): AccessConfig | undefined {
  const { ACCESS_AUDIENCE: audience, ACCESS_OWNER_EMAIL: ownerEmail, ACCESS_TEAM_DOMAIN: teamDomain } = env;
  if (typeof audience !== "string" || !audience || typeof ownerEmail !== "string" || !ownerEmail || typeof teamDomain !== "string" || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(teamDomain)) return undefined;
  return { audience, ownerEmail, teamDomain };
}
export async function verifyAccessJwt(token: string | null, config: AccessConfig): Promise<boolean> {
  if (!token) return false;
  try {
    const issuer = `https://${config.teamDomain}`;
    const jwks = jwksFor(config.teamDomain);
    const { payload } = await jwtVerify(token, jwks, { algorithms: ["RS256"], issuer, audience: config.audience, requiredClaims: ["exp", "email"] });
    return payload.email === config.ownerEmail;
  } catch { return false; }
}
