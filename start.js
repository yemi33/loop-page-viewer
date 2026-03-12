/**
 * Bootstrap — ensures dependencies are installed and UI is built,
 * then launches the MCP server via stdio.
 *
 * Usage:  node start.js
 *
 * This is the ONLY file users need to run. On first launch it will
 * automatically `npm install` and `npm run build` so no manual setup
 * is required beyond having Node.js (>= 18) installed.
 */

import { existsSync } from "node:fs";
import { execSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const log = (msg) => console.error(`[loop-page-viewer] ${msg}`);

const __filename = fileURLToPath(import.meta.url);
const projectRoot = dirname(__filename);
const isWindows = process.platform === "win32";
const shellOpt = isWindows ? { shell: true } : {};

try {
  const nmPath = resolve(projectRoot, "node_modules");
  if (!existsSync(nmPath)) {
    log("node_modules not found — installing...");
    execSync("npm install --no-fund --no-audit", {
      cwd: projectRoot,
      stdio: ["ignore", "ignore", "inherit"],
    });
    log("Dependencies installed.");
  }

  const distPath = resolve(projectRoot, "dist", "mcp-app.html");
  if (!existsSync(distPath)) {
    log("dist not found — building UI bundle...");
    execSync("npm run build", {
      cwd: projectRoot,
      stdio: ["ignore", "ignore", "inherit"],
    });
    log("Build complete.");
  }

  // Launch the server with tsx (inherits stdio for MCP transport)
  execFileSync("npx", ["tsx", resolve(projectRoot, "server.ts")], {
    cwd: projectRoot,
    stdio: "inherit",
    ...shellOpt,
  });
} catch (err) {
  log(`FATAL: ${err.message}`);
  process.exit(1);
}
