import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireDependency = createRequire(import.meta.url);
const eventId = "6fdc0858-8883-4e4e-a31f-50f38e341177";
const defaultEnv = {
  BACKEND_URL: "http://backend.test:8000",
  BACKEND_INTERNAL_SECRET: "server-only-test-secret",
};

// Run the real TypeScript route/helper without requiring a Next.js server or
// adding a test framework. Only session lookup and HTTP transport are replaced.
function loadModule(filename, { session = { user: { id: "7" } }, env = defaultEnv, fetch } = {}) {
  const source = ts.transpileModule(
    fs.readFileSync(path.join(root, filename), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
  ).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(source, {
    module: compiledModule,
    exports: compiledModule.exports,
    require(name) {
      if (name === "next-auth") return { getServerSession: async () => session };
      if (name === "@/app/api/auth/[...nextauth]/route") return { authOptions: {} };
      return requireDependency(name);
    },
    process: { env },
    fetch,
  }, { filename });
  return compiledModule.exports;
}

function request(body) {
  return new Request("http://localhost/api/displays", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("display route requires a signed-in user", async () => {
  const { POST } = loadModule("app/api/displays/route.ts", {
    session: null,
    fetch() { assert.fail("Unauthenticated requests must not reach FastAPI"); },
  });
  const response = await POST(request({ media_id: 10, event_id: eventId }));
  assert.equal(response.status, 401);
});

test("display route derives the user from the session and keeps the secret server-side", async () => {
  let upstream;
  const { POST } = loadModule("app/api/displays/route.ts", {
    fetch: async (url, options) => {
      upstream = { url, options };
      return Response.json({ ok: true });
    },
  });
  const response = await POST(request({ media_id: 10, event_id: eventId, user_id: 999 }));
  assert.equal(response.status, 200);
  assert.equal(upstream.url, "http://backend.test:8000/api/displays/7");
  assert.equal(upstream.options.headers["backend-internal-secret"], defaultEnv.BACKEND_INTERNAL_SECRET);
  assert.deepEqual(JSON.parse(upstream.options.body), { media_id: 10, event_id: eventId });
  assert.deepEqual(await response.json(), { ok: true });
});

test("malformed JSON and invalid media IDs return 400", async () => {
  const { POST } = loadModule("app/api/displays/route.ts", {
    fetch() { assert.fail("Invalid browser input must not reach FastAPI"); },
  });
  for (const body of [null, [], {}, { media_id: -1, event_id: eventId },
    { media_id: 0, event_id: eventId }, { media_id: 1.5, event_id: eventId },
    { media_id: true, event_id: eventId }, { media_id: "10", event_id: eventId },
    { media_id: Number.MAX_SAFE_INTEGER + 1, event_id: eventId }, { media_id: 10 }]) {
    assert.equal((await POST(request(body))).status, 400);
  }
  const brokenJson = new Request("http://localhost/api/displays", { method: "POST", body: "{" });
  assert.equal((await POST(brokenJson)).status, 400);
});

test("missing backend configuration returns a JSON error", async () => {
  const { POST } = loadModule("app/api/displays/route.ts", {
    env: {},
    fetch() { assert.fail("Unconfigured requests must not be forwarded"); },
  });
  const response = await POST(request({ media_id: 10, event_id: eventId }));
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Backend environment variables are missing" });
});

test("FastAPI errors retain their status without leaking upstream details", async () => {
  for (const status of [401, 404, 409, 422, 500]) {
    const { POST } = loadModule("app/api/displays/route.ts", {
      fetch: async () => Response.json({ detail: "private upstream detail" }, { status }),
    });
    const response = await POST(request({ media_id: 10, event_id: eventId }));
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), { error: "Failed to record display" });
  }
});

test("a backend connection failure returns 502", async () => {
  const { POST } = loadModule("app/api/displays/route.ts", {
    fetch: async () => { throw new Error("Connection refused"); },
  });
  const response = await POST(request({ media_id: 10, event_id: eventId }));
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "Backend unavailable" });
});

test("browser helper sends only the display identity and keeps navigation requests alive", async () => {
  let sent;
  const { recordMediaDisplay } = loadModule("lib/api.ts", {
    fetch: async (url, options) => {
      sent = { url, options };
      return Response.json({ ok: true });
    },
  });
  await recordMediaDisplay(10, eventId);
  assert.equal(sent.url, "/api/displays");
  assert.equal(sent.options.method, "POST");
  assert.equal(sent.options.keepalive, true);
  assert.equal(sent.options.headers["backend-internal-secret"], undefined);
  assert.deepEqual(JSON.parse(sent.options.body), { media_id: 10, event_id: eventId });
});

test("browser helper rejects unsuccessful recording attempts", async () => {
  const { recordMediaDisplay } = loadModule("lib/api.ts", {
    fetch: async () => Response.json({ error: "Backend unavailable" }, { status: 502 }),
  });
  await assert.rejects(recordMediaDisplay(10, eventId), /recordMediaDisplay failed: 502/);
});
