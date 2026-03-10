import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESOURCE_MIME_TYPE = "text/html";
const server = new McpServer({
  name: "Loop Page Viewer",
  version: "1.0.0",
});

const viewerResourceUri = "ui://loop-page-viewer/mcp-app.html";

// Tool to show a Loop page inline in chat
server.tool(
  "show_loop_page",
  "Renders a Loop page inline in chat with view and edit capabilities. " +
    "Use this after creating or fetching a Loop page to display it interactively. " +
    "Pass the page title, markdown content, link, workspaceId, and pageId.",
  {
    title: z.string().describe("The page title"),
    content: z.string().describe("The page content in Markdown format"),
    link: z.string().describe("Deep link to open the page in Loop"),
    workspaceId: z.string().describe("The workspace pod ID containing the page"),
    pageId: z.string().describe("The base64-encoded page ID"),
  },
  async ({ title, content, link, workspaceId, pageId }) => {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ title, content, link, workspaceId, pageId }),
        },
      ],
      _meta: { ui: { resourceUri: viewerResourceUri } },
    };
  },
);

// Tool the UI calls when the user saves edits
server.tool(
  "request_page_update",
  "Called by the inline Loop page viewer when the user edits and saves. " +
    "Returns the updated content so the host can forward it to the Loop MCP " +
    "server via mcp__loop__update_page.",
  {
    workspaceId: z.string().describe("The workspace pod ID"),
    pageId: z.string().describe("The base64-encoded page ID"),
    title: z.string().describe("Updated page title"),
    content: z.string().describe("Updated page content in Markdown"),
  },
  async ({ workspaceId, pageId, title, content }) => {
    return {
      content: [
        {
          type: "text" as const,
          text:
            `The user has edited this Loop page in the inline viewer. ` +
            `Please update the Loop page using mcp__loop__update_page with:\n` +
            `- workspaceId: ${workspaceId}\n` +
            `- pageId: ${pageId}\n` +
            `- title: ${title}\n` +
            `- content:\n${content}\n` +
            `- replaceAll: true`,
        },
      ],
    };
  },
);

// Serve the bundled HTML as a resource
server.resource(viewerResourceUri, viewerResourceUri, async () => {
  const html = await fs.readFile(
    path.join(__dirname, "dist", "mcp-app.html"),
    "utf-8",
  );
  return {
    contents: [
      { uri: viewerResourceUri, mimeType: RESOURCE_MIME_TYPE, text: html },
    ],
  };
});

// Choose transport based on CLI flag
const useHttp = process.argv.includes("--http");

if (useHttp) {
  const expressApp = express();
  expressApp.use(cors());
  expressApp.use(express.json());

  expressApp.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const PORT = parseInt(process.env.PORT || "3001", 10);
  expressApp.listen(PORT, () => {
    console.error(`Loop Page Viewer listening on http://localhost:${PORT}/mcp`);
  });
} else {
  // stdio transport for Claude Code
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Loop Page Viewer MCP server running on stdio");
}
