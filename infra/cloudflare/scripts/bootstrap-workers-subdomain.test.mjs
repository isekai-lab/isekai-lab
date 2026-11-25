import assert from "node:assert/strict";
import test from "node:test";
import { ensureWorkersSubdomain } from "./bootstrap-workers-subdomain.mjs";

test("a 404 GET registers the requested workers.dev subdomain", async () => {
  const calls = [];
  const fetchFn = async (_url, init) => {
    calls.push(init);
    if (init.method === "GET") return new Response("not found", { status: 404 });
    return Response.json({ success: true, result: { subdomain: "circle-games" } });
  };
  const result = await ensureWorkersSubdomain({ accountId: "account", token: "secret", desired: "circle-games", fetchFn });
  assert.equal(result, "registered");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].method, "PUT");
  assert.equal(calls[1].body, '{"subdomain":"circle-games"}');
});

test("a differing existing subdomain is never modified", async () => {
  const fetchFn = async () => Response.json({ success: true, result: { subdomain: "already-used" } });
  await assert.rejects(() => ensureWorkersSubdomain({ accountId: "account", token: "secret", desired: "circle-games", fetchFn }), /refusing to change/);
});
