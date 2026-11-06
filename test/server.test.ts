import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createMcpHttpServer,
  listRegisteredToolNames,
} from "../src/server.ts";
import { MockVehicleBackend } from "../src/backend.ts";

const bearer = "test-bearer-token-at-least-32-chars!";

async function withServer(
  run: (baseUrl: string) => Promise<void>,
  allowedHosts?: string[],
): Promise<void> {
  const server = createMcpHttpServer({
    bearerToken: bearer,
    allowedHosts,
    backend: new MockVehicleBackend(),
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "localhost", () => resolve());
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://localhost:${address.port}`;
  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

test("lists the seven v1 tools and never exposes approve or confirm", () => {
  const names = listRegisteredToolNames();
  assert.deepEqual(names, [
    "send_navigation",
    "vehicle_status",
    "charge_status",
    "climate_on",
    "climate_off",
    "lock",
    "unlock",
  ]);
  assert.equal(names.includes("approve"), false);
  assert.equal(names.includes("confirm"), false);
});

test("serves health without a bearer token", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { ok: boolean };
    assert.equal(body.ok, true);
  });
});

test("rejects a missing bearer token on /mcp", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Host: "localhost",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "test", version: "0.0.0" },
        },
      }),
    });
    assert.equal(res.status, 401);
  });
});

test("mock vehicle_status returns cache by default", async () => {
  const backend = new MockVehicleBackend();
  const cached = await backend.vehicleStatus({});
  assert.equal(cached.ok, true);
  assert.equal(cached.source, "cache");
  const live = await backend.vehicleStatus({ live: true });
  assert.equal(live.source, "live");
});

test("mock lock returns pending without claiming a Tesla call", async () => {
  const backend = new MockVehicleBackend();
  const pending = await backend.requestLock();
  assert.equal(pending.pending, true);
  assert.equal(pending.result, false);
  assert.match(pending.reason, /awaiting_human_confirm/);
});
