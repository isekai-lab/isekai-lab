import assert from "node:assert/strict";
import test from "node:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { handleRequest } from "./index.ts";
import { resetAccessJwksCacheForTests } from "./auth.ts";

const hostname = "tensei-private-games.example-team.workers.dev";
const teamDomain = "example-team.cloudflareaccess.com";
const audience = "access-audience";
const owner = "owner@example.invalid";

async function signedToken(claims: Record<string, unknown> = {}, expiresIn = "5m") {
  const keys = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(keys.publicKey);
  publicJwk.kid = "test-key";
  const token = await new SignJWT({ email: owner, ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(`https://${teamDomain}`)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(keys.privateKey);
  return { publicJwk, privateKey: keys.privateKey, token };
}

async function tokenWith(privateKey: CryptoKey, options: { audience?: string; expiresIn?: string; includeExp?: boolean; issuer?: string } = {}) {
  const jwt = new SignJWT({ email: owner })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(options.issuer ?? `https://${teamDomain}`)
    .setAudience(options.audience ?? audience)
    .setIssuedAt();
  if (options.includeExp !== false) jwt.setExpirationTime(options.expiresIn ?? "5m");
  return jwt.sign(privateKey);
}

async function run(token: string | null, publicJwk: JsonWebKey, url = `https://${hostname}/game1.html`, jwksResponse: () => Response = () => Response.json({ keys: [publicJwk] })) {
  resetAccessJwksCacheForTests();
  const originalFetch = globalThis.fetch;
  let assetsCalls = 0;
  globalThis.fetch = async (input) => {
    assert.equal(String(input), `https://${teamDomain}/cdn-cgi/access/certs`);
    return jwksResponse();
  };
  try {
    const response = await handleRequest(new Request(url, { headers: token ? { "Cf-Access-Jwt-Assertion": token } : {} }), {
      PRIVATE_HOSTNAME: hostname, ACCESS_AUDIENCE: audience, ACCESS_TEAM_DOMAIN: teamDomain, ACCESS_OWNER_EMAIL: owner,
      ASSETS: { fetch: async () => { assetsCalls += 1; return new Response("asset"); } },
    });
    return { response, assetsCalls };
  } finally { globalThis.fetch = originalFetch; }
}

test("valid Cloudflare Access RS256 JWT reaches assets", { concurrency: false }, async () => {
  const { token, publicJwk } = await signedToken();
  const result = await run(token, publicJwk);
  assert.equal(result.response.status, 200);
  assert.equal(result.assetsCalls, 1);
  assert.equal(result.response.headers.get("Cache-Control"), "no-store");
});

test("the protected HD-2D route rejects missing or forged Access JWTs", { concurrency: false }, async () => {
  const valid = await signedToken();
  let result = await run(null, valid.publicJwk, `https://${hostname}/hd-2d/`);
  assert.equal(result.response.status, 403);
  assert.equal(result.assetsCalls, 0);
  const forged = await signedToken();
  result = await run(forged.token, valid.publicJwk, `https://${hostname}/hd-2d/`);
  assert.equal(result.response.status, 403);
  assert.equal(result.assetsCalls, 0);
  result = await run(valid.token, valid.publicJwk, `https://${hostname}/hd-2d/`);
  assert.equal(result.response.status, 200);
  assert.equal(result.assetsCalls, 1);
});

test("wrong email, audience, expiry, and a forged signature cannot reach assets", { concurrency: false }, async () => {
  const valid = await signedToken({ email: "other@example.invalid" });
  let result = await run(valid.token, valid.publicJwk);
  assert.equal(result.response.status, 403); assert.equal(result.assetsCalls, 0);
  assert.equal(result.response.headers.get("Cache-Control"), "no-store");
  const wrongAudience = await signedToken({});
  result = await run(await tokenWith(wrongAudience.privateKey, { audience: "wrong" }), wrongAudience.publicJwk);
  assert.equal(result.response.status, 403); assert.equal(result.assetsCalls, 0);
  const wrongIssuer = await signedToken({});
  result = await run(await tokenWith(wrongIssuer.privateKey, { issuer: "https://other.cloudflareaccess.com" }), wrongIssuer.publicJwk);
  assert.equal(result.response.status, 403); assert.equal(result.assetsCalls, 0);
  const expired = await signedToken();
  result = await run(await tokenWith(expired.privateKey, { expiresIn: "-1s" }), expired.publicJwk);
  assert.equal(result.response.status, 403); assert.equal(result.assetsCalls, 0);
  const jwksUnavailable = await signedToken();
  result = await run(jwksUnavailable.token, jwksUnavailable.publicJwk, `https://${hostname}/game1.html`, () => new Response("unavailable", { status: 503 }));
  assert.equal(result.response.status, 403); assert.equal(result.assetsCalls, 0);
  const noExpiry = await signedToken();
  result = await run(await tokenWith(noExpiry.privateKey, { includeExp: false }), noExpiry.publicJwk);
  assert.equal(result.response.status, 403); assert.equal(result.assetsCalls, 0);
  const forged = await signedToken();
  result = await run(forged.token, valid.publicJwk);
  assert.equal(result.response.status, 403); assert.equal(result.assetsCalls, 0);
});

test("missing token, unexpected host, and incomplete config fail closed", { concurrency: false }, async () => {
  const key = await signedToken();
  let result = await run(null, key.publicJwk);
  assert.equal(result.response.status, 403); assert.equal(result.assetsCalls, 0);
  result = await run(key.token, key.publicJwk, "https://unprotected.example.invalid/game1.html");
  assert.equal(result.response.status, 403); assert.equal(result.assetsCalls, 0);
  const response = await handleRequest(new Request(`https://${hostname}/`), {
    PRIVATE_HOSTNAME: hostname, ACCESS_AUDIENCE: "", ACCESS_TEAM_DOMAIN: teamDomain, ACCESS_OWNER_EMAIL: owner,
    ASSETS: { fetch: async () => { throw new Error("must not fetch assets"); } },
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});
