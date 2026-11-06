# Tesla Fleet MCP

Public reference for a Streamable HTTP [MCP](https://modelcontextprotocol.io) server that can talk to one Tesla vehicle through Tesla's official [Fleet API](https://developer.tesla.com/docs/fleet-api/getting-started/what-is-fleet-api).

This repository is the **public** view of the project. It includes:

- Architecture notes and Mermaid process-flow diagrams in [docs/architecture.md](docs/architecture.md)
- A minimal MCP server entry point you can run locally with a mock vehicle backend
- Secret-scanning standard v1 scaffolding

It does **not** include private operator hosts, account identifiers, PEM keys, encrypted token stores, or a live Fleet API adapter. A private working copy stays separate.

## What v1 can do

Tools:

- `send_navigation` — send an address to vehicle navigation
- `vehicle_status` — climate and vehicle state (cached by default; set `live` for a fresh read)
- `charge_status` — charge state the same way
- `climate_on` / `climate_off` — start or stop preconditioning
- `lock` / `unlock` — create a pending door request (never call Tesla from the tool itself)

Safety model:

- `/mcp` requires `Authorization: Bearer`
- Unknown `Host` / `Origin` values are rejected
- There is no `approve` or `confirm` MCP tool
- Door lock and unlock wait for a human confirm page off public ingress; GET never moves the locks
- Production deployments keep `TESLA_CLIENT_SECRET`, refresh tokens, and the command-signing key on hardware you control

## Quick start (mock backend)

Requires Node.js 22 or newer.

```bash
npm install
npm test
npm run build
npm start
```

Defaults:

- Bind host: `localhost`
- Port: `3000`
- Health: `GET /health`
- MCP: `POST /mcp` with `Authorization: Bearer` matching `TESLA_MCP_BEARER_TOKEN` (default demo value is for local use only)

Example:

```bash
curl -sS http://localhost:3000/health
```

Set `TESLA_MCP_BEARER_TOKEN` and optional `MCP_ALLOWED_HOSTS` before exposing anything beyond your machine.

## Architecture

Read [docs/architecture.md](docs/architecture.md) for:

1. Trust zones and system boundary
2. One-time OAuth and virtual-key pairing sequence
3. Steady-state MCP tools and human door confirmation
4. Essential platform constraints versus v1 scaffolding to collapse in v2

## Secret scanning

Follow [docs/standards/secret-scanning.md](docs/standards/secret-scanning.md).

```bash
scripts/install-hooks.sh
```

Never commit with `--no-verify`. Never commit secrets, keys, tokens, or personal data.

## License

Apache License 2.0. See [LICENSE](LICENSE).
