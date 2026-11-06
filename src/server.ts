import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import {
  createMcpHandler,
  McpServer,
} from "@modelcontextprotocol/server";
import {
  hostHeaderValidation,
  localhostHostValidation,
  localhostOriginValidation,
  originValidation,
  toNodeHandler,
} from "@modelcontextprotocol/node";
import * as z from "zod/v4";
import {
  MockVehicleBackend,
  type VehicleBackend,
} from "./backend.js";

const MCP_PATH = "/mcp";

const liveInputSchema = z.object({
  live: z
    .boolean()
    .optional()
    .describe("When true, request a fresh read that may wake the vehicle"),
});

const commandOutputSchema = z.object({
  result: z.boolean(),
  reason: z.string(),
  queued: z.boolean().optional(),
});

const pendingOutputSchema = z.object({
  result: z.boolean(),
  pending: z.boolean(),
  confirm_url: z.string().optional(),
  reason: z.string(),
});

export type ServerOptions = {
  bearerToken: string;
  allowedHosts?: string[];
  backend?: VehicleBackend;
};

function toolResult(output: Record<string, unknown>, isError: boolean) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(output) }],
    structuredContent: output,
    isError,
  };
}

function createToolServer(backend: VehicleBackend): McpServer {
  const server = new McpServer({
    name: "tesla-fleet-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "send_navigation",
    {
      title: "Send navigation",
      description:
        "Send an address to the paired vehicle navigation. Do not include a VIN.",
      inputSchema: z.object({
        address: z.string().min(1).max(500).describe("Destination address"),
        locale: z
          .string()
          .min(2)
          .max(16)
          .optional()
          .describe("Locale such as en-US"),
      }),
      outputSchema: commandOutputSchema,
    },
    async ({ address, locale }) => {
      const output = await backend.sendNavigation({ address, locale });
      return toolResult(output, !output.result);
    },
  );

  server.registerTool(
    "vehicle_status",
    {
      title: "Vehicle status",
      description:
        "Read climate and vehicle state. Set live true only when you need a fresh read. Do not include a VIN.",
      inputSchema: liveInputSchema,
      outputSchema: z.object({
        ok: z.boolean(),
        state: z.string(),
        source: z.enum(["cache", "live", "none"]),
        climate: z.unknown().optional(),
        vehicle_state: z.unknown().optional(),
        reason: z.string().optional(),
      }),
    },
    async ({ live }) => {
      const output = await backend.vehicleStatus({ live });
      return toolResult(output, !output.ok);
    },
  );

  server.registerTool(
    "charge_status",
    {
      title: "Charge status",
      description:
        "Read charge state. Set live true only when you need a fresh read. Do not include a VIN.",
      inputSchema: liveInputSchema,
      outputSchema: z.object({
        ok: z.boolean(),
        state: z.string(),
        source: z.enum(["cache", "live", "none"]),
        charge: z.unknown().optional(),
        reason: z.string().optional(),
      }),
    },
    async ({ live }) => {
      const output = await backend.chargeStatus({ live });
      return toolResult(output, !output.ok);
    },
  );

  server.registerTool(
    "climate_on",
    {
      title: "Climate on",
      description: "Start climate preconditioning. Do not include a VIN.",
      inputSchema: z.object({}),
      outputSchema: commandOutputSchema,
    },
    async () => {
      const output = await backend.climateOn();
      return toolResult(output, !output.result);
    },
  );

  server.registerTool(
    "climate_off",
    {
      title: "Climate off",
      description: "Stop climate preconditioning. Do not include a VIN.",
      inputSchema: z.object({}),
      outputSchema: commandOutputSchema,
    },
    async () => {
      const output = await backend.climateOff();
      return toolResult(output, !output.result);
    },
  );

  server.registerTool(
    "lock",
    {
      title: "Lock",
      description:
        "Create a pending lock request. A human must confirm it on a private-overlay confirm page. This tool never locks the vehicle.",
      inputSchema: z.object({}),
      outputSchema: pendingOutputSchema,
    },
    async () => {
      const output = await backend.requestLock();
      return toolResult(output, !output.result && !output.pending);
    },
  );

  server.registerTool(
    "unlock",
    {
      title: "Unlock",
      description:
        "Create a pending unlock request. A human must confirm it on a private-overlay confirm page. This tool never unlocks the vehicle.",
      inputSchema: z.object({}),
      outputSchema: pendingOutputSchema,
    },
    async () => {
      const output = await backend.requestUnlock();
      return toolResult(output, !output.result && !output.pending);
    },
  );

  return server;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function urlPath(url: string | undefined): string {
  if (!url) {
    return "/";
  }
  try {
    return new URL(url, "http://localhost").pathname;
  } catch {
    return "/";
  }
}

function sendJson(
  res: ServerResponse,
  status: number,
  body: Record<string, unknown>,
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function hasValidBearer(req: IncomingMessage, expected: string): boolean {
  const header = headerValue(req.headers.authorization);
  if (!header || !header.startsWith("Bearer ")) {
    return false;
  }
  const provided = Buffer.from(header.slice("Bearer ".length));
  const wanted = Buffer.from(expected);
  if (provided.length !== wanted.length) {
    timingSafeEqual(wanted, wanted);
    return false;
  }
  return timingSafeEqual(provided, wanted);
}

function buildHostValidator(allowedHosts: string[] | undefined) {
  const extra = (allowedHosts ?? [])
    .map((h) => h.trim())
    .filter(Boolean);
  if (extra.length === 0) {
    return localhostHostValidation();
  }
  return hostHeaderValidation(["localhost", ...extra]);
}

function buildOriginValidator(allowedHosts: string[] | undefined) {
  const extra = (allowedHosts ?? [])
    .map((h) => h.trim())
    .filter(Boolean);
  if (extra.length === 0) {
    return localhostOriginValidation();
  }
  return originValidation(["localhost", ...extra]);
}

export function createMcpHttpServer(options: ServerOptions) {
  const backend = options.backend ?? new MockVehicleBackend();
  const validateHost = buildHostValidator(options.allowedHosts);
  const validateOrigin = buildOriginValidator(options.allowedHosts);
  const handler = createMcpHandler(
    () => createToolServer(backend),
    { responseMode: "json" },
  );
  const nodeHandler = toNodeHandler(handler);

  const server = createServer((req, res) => {
    void (async () => {
      try {
        const path = urlPath(req.url);
        if (req.method === "GET" && path === "/health") {
          sendJson(res, 200, { ok: true });
          return;
        }
        if (!validateHost(req, res) || !validateOrigin(req, res)) {
          return;
        }
        if (path !== MCP_PATH) {
          sendJson(res, 404, { error: "not_found" });
          return;
        }
        if (!hasValidBearer(req, options.bearerToken)) {
          sendJson(res, 401, { error: "unauthorized" });
          return;
        }
        await nodeHandler(req, res);
      } catch (error) {
        if (!res.headersSent) {
          sendJson(res, 500, {
            error: error instanceof Error ? error.message : "internal_error",
          });
        }
      }
    })();
  });

  server.on("close", () => {
    void handler.close();
  });

  return server;
}

export function listRegisteredToolNames(): string[] {
  return [
    "send_navigation",
    "vehicle_status",
    "charge_status",
    "climate_on",
    "climate_off",
    "lock",
    "unlock",
  ];
}
