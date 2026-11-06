import { createMcpHttpServer } from "./server.js";

const host = process.env.MCP_BIND_HOST ?? "localhost";
const port = Number(process.env.MCP_BIND_PORT ?? "3000");
const bearerToken =
  process.env.TESLA_MCP_BEARER_TOKEN ??
  "local-dev-bearer-token-change-me-32b";
const allowedHosts = (process.env.MCP_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("MCP_BIND_PORT must be an integer from 1 to 65535");
}

const server = createMcpHttpServer({
  bearerToken,
  allowedHosts,
});

server.listen(port, host, () => {
  process.stdout.write(
    `tesla-fleet-mcp listening on ${host}:${String(port)} (mock backend)\n`,
  );
});
