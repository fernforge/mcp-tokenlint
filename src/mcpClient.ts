import { spawn } from "node:child_process";
import type { McpTool } from "./types.js";

/**
 * Spawn an MCP server over stdio, run the JSON-RPC handshake, and return its
 * advertised tools. This lets you lint a *live* server without a manual dump:
 *   mcp-tokenlint --cmd "node build/server.js"
 */
export async function fetchToolsViaStdio(
  command: string,
  args: string[] = [],
  timeoutMs = 15000
): Promise<McpTool[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "inherit"],
      shell: false,
    });

    let buffer = "";
    let settled = false;
    const timer = setTimeout(() => {
      finish(new Error(`Timed out after ${timeoutMs}ms waiting for the server.`));
    }, timeoutMs);

    function finish(err: Error | null, tools?: McpTool[]) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      err ? reject(err) : resolve(tools ?? []);
    }

    function send(msg: unknown) {
      child.stdin.write(JSON.stringify(msg) + "\n");
    }

    child.on("error", (e) => finish(e));
    child.on("exit", (code) => {
      if (!settled) finish(new Error(`Server exited (code ${code}) before returning tools.`));
    });

    child.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      let idx: number;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        let msg: any;
        try {
          msg = JSON.parse(line);
        } catch {
          continue; // ignore non-JSON log noise
        }
        if (msg.id === 1 && msg.result) {
          // initialize ack -> announce initialized, then ask for tools.
          send({ jsonrpc: "2.0", method: "notifications/initialized" });
          send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
        } else if (msg.id === 2) {
          if (msg.error) return finish(new Error(`tools/list error: ${JSON.stringify(msg.error)}`));
          finish(null, (msg.result?.tools as McpTool[]) ?? []);
        }
      }
    });

    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "mcp-tokenlint", version: "0.1.0" },
      },
    });
  });
}
