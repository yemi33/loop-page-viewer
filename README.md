# Loop Page Viewer

MCP App that renders Microsoft Loop pages inline in chat with view and edit capabilities.

When an LLM creates or fetches a Loop page, this server displays it as an interactive widget — rendered markdown with an edit mode — directly in the conversation instead of just returning text.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- An MCP host that supports [MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview) (Claude Desktop, claude.ai, VS Code Copilot, Goose, etc.)
- A Loop MCP server for fetching/updating pages (e.g., `@microsoft/loop-mcp`)

## Setup

### 1. Clone and build

```bash
git clone https://github.com/yemi33/loop-page-viewer.git
cd loop-page-viewer
npm install
npm run build
```

### 2. Add to Claude Code

Add to your `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "loop-page-viewer": {
      "command": "npx",
      "args": ["tsx", "/path/to/loop-page-viewer/server.ts"],
      "tools": ["*"]
    }
  }
}
```

Replace `/path/to/loop-page-viewer` with the actual path to the cloned repo.

### 3. Add to VS Code (Copilot)

Add to your `.vscode/mcp.json`:

```json
{
  "servers": {
    "loop-page-viewer": {
      "type": "stdio",
      "command": "npx",
      "args": ["tsx", "/path/to/loop-page-viewer/server.ts"]
    }
  }
}
```

### 4. Add to Claude Desktop or other web hosts

Start the server in HTTP mode:

```bash
npm run serve:http
```

Then connect your host to `http://localhost:3001/mcp`. For Claude Desktop, use [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/) to tunnel:

```bash
npx cloudflared tunnel --url http://localhost:3001
```

Add the generated URL as a custom connector in Claude Desktop settings.

## Tools

| Tool | Description |
|------|-------------|
| `show_loop_page` | Renders a Loop page inline with view/edit UI. Accepts title, content (markdown), link, workspaceId, and pageId. |
| `request_page_update` | Called by the inline editor when the user saves. Returns instructions for the host to forward the update to the Loop MCP server. |

## How it works

1. You ask the LLM to create or fetch a Loop page (via your Loop MCP server)
2. The LLM calls `show_loop_page` with the page data
3. The host renders an interactive viewer inline in chat (sandboxed iframe)
4. You can view the rendered markdown or switch to edit mode
5. On save, the app calls `request_page_update`, and the LLM forwards the changes to `mcp__loop__update_page`

## Development

```bash
npm run build          # Build the UI bundle
npm run serve          # Start in stdio mode (for Claude Code)
npm run serve:http     # Start in HTTP mode (for web hosts, port 3001)
npm run dev            # Build + start HTTP mode
```

To test with the [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```bash
npx @modelcontextprotocol/inspector npx tsx server.ts
```

To test rendering with the [basic-host](https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/basic-host):

```bash
npm run serve:http
# In another terminal:
git clone https://github.com/modelcontextprotocol/ext-apps.git
cd ext-apps/examples/basic-host
npm install
SERVERS='["http://localhost:3001/mcp"]' npm start
# Open http://localhost:8080
```
